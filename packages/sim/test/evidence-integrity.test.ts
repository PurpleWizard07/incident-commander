import { describe, it, expect } from "vitest";
import { materializeWorld } from "../src/world.js";
import { HERO_CHECKOUT_SCENARIO, NOW_MINUTE, PAYMENTS_SPIKE_MINUTE, ONSET_MINUTE } from "../src/scenarios/hero-checkout.js";

const world = materializeWorld(HERO_CHECKOUT_SCENARIO, 42, NOW_MINUTE);

function series(service: string, metric: string) {
  return world.metrics.find((m) => m.service === service && m.metric === metric)!;
}

function lastValue(service: string, metric: string) {
  const s = series(service, metric);
  return s.points[s.points.length - 1].value;
}

describe("evidence integrity — INC-4821 (plan §14.1, §5.1)", () => {
  it("matches the health snapshot at T_now: checkout and payments degraded, payments worse", () => {
    expect(lastValue("checkout", "error_rate")).toBeGreaterThan(0.5);
    expect(lastValue("payments", "error_rate")).toBeGreaterThan(0.7);
    // Payments looks worse than checkout — the distractor the investigation must see past.
    expect(lastValue("payments", "error_rate")).toBeGreaterThan(lastValue("checkout", "error_rate"));
  });

  it("leaves auth, database, queue, and notifications healthy", () => {
    for (const svc of ["auth", "database", "queue", "notifications"]) {
      expect(lastValue(svc, "error_rate")).toBeLessThan(0.05);
    }
  });

  it("keeps checkout latency normal — it fails fast, it does not hang", () => {
    const latency = series("checkout", "latency_p95");
    const last = latency.points[latency.points.length - 1].value;
    // Within ~15% of the 240ms baseline for the whole window, never spiking.
    for (const p of latency.points) {
      expect(p.value).toBeLessThan(latency.baseline * 1.2);
    }
    expect(last).toBeLessThan(300);
  });

  it("gives 100% of failing traces a checkout-v3 tag on the failing span, never checkout-v2", () => {
    const failing = world.traces.filter((t) => t.status === "error");
    expect(failing.length).toBeGreaterThan(0);
    for (const trace of failing) {
      const failingSpan = trace.spans.find((s) => s.spanId === trace.failingSpanId);
      expect(failingSpan?.name).toBe(HERO_CHECKOUT_SCENARIO.groundTruth.failingSpanName);
      expect(failingSpan?.attributes.deployment).toBe("checkout-v3");
    }
  });

  it("stops the call chain at the failing span — no descendant of it appears at any depth", () => {
    // Regression test: an earlier version only checked a span's DIRECT parent
    // against the failed-name set, so a grandchild whose parent was itself
    // SKIPPED (rather than evaluated-and-failed) incorrectly resumed
    // execution one level below the real failure — e.g. checkout.callPayments
    // correctly vanished, but payments.processPayment (its child) still
    // appeared with parentSpanId: null, as if it had been called directly.
    const failing = world.traces.filter((t) => t.status === "error");
    expect(failing.length).toBeGreaterThan(0);
    const descendantNames = ["checkout.callPayments", "payments.processPayment", "payments.callDatabase", "database.query"];
    for (const trace of failing) {
      const names = trace.spans.map((s) => s.name);
      for (const forbidden of descendantNames) {
        expect(names).not.toContain(forbidden);
      }
    }
  });

  it("still serves some post-onset traces successfully from lingering checkout-v2 instances", () => {
    // The whole post-onset window, not a narrow slice of it: at ~2.2 traces/min
    // and an 18% lingering-v2 draw, a narrower window occasionally lands zero
    // by chance for a given seed even though the mechanism is working
    // correctly — this width gives a comfortable statistical margin instead.
    const postOnset = world.traces.filter((t) => t.minute >= ONSET_MINUTE && t.minute <= NOW_MINUTE);
    const succeededOnV2 = postOnset.filter((t) => {
      const span = t.spans.find((s) => s.name === "checkout.validatePaymentToken");
      return span?.status === "ok" && span.attributes.deployment === "checkout-v2";
    });
    expect(succeededOnV2.length).toBeGreaterThan(0);
  });

  it("gates the checkout error log to checkout-v3 only, never appearing on checkout-v2", () => {
    const checkoutErrors = world.logs.filter((l) => l.service === "checkout" && l.level === "ERROR");
    expect(checkoutErrors.length).toBeGreaterThan(0);
    for (const entry of checkoutErrors) {
      expect(entry.deployment).toBe("checkout-v3");
    }
  });

  it("starts the payments error log at the payments spike minute, not before", () => {
    const paymentsErrors = world.logs.filter((l) => l.service === "payments" && l.level === "ERROR");
    expect(paymentsErrors.length).toBeGreaterThan(0);
    for (const entry of paymentsErrors) {
      expect(entry.minute).toBeGreaterThanOrEqual(PAYMENTS_SPIKE_MINUTE);
    }
  });

  it("shows checkout-v3 as the only deployment in the window, with payments-v4 visibly six days old", () => {
    expect(world.changes).toEqual([]);
    const checkoutV3 = world.deployments.find((d) => d.id === "checkout-v3")!;
    const paymentsV4 = world.deployments.find((d) => d.id === "payments-v4")!;
    expect(checkoutV3.rollbackTargetId).toBe("checkout-v2");
    expect(NOW_MINUTE - paymentsV4.deployedAtMinute).toBeGreaterThan(6 * 24 * 60 - 1);
  });

  it("never leaks scenarioId or groundTruth into any individual generated record", () => {
    const records: unknown[] = [
      ...world.metrics,
      ...world.logs,
      ...world.traces,
      ...world.deployments,
      ...world.changes,
      ...world.alerts,
    ];
    for (const record of records) {
      expect(record).not.toHaveProperty("groundTruth");
      expect(record).not.toHaveProperty("scenarioId");
    }
    // World.scenarioId itself is legitimate engine-internal bookkeeping (plan §3.9
    // discussion in the sim types) — the thing that must never leak is a tool/API
    // response, and no such layer exists yet in Phase 1.
    expect(world.scenarioId).toBe("INC-4821");
  });
});
