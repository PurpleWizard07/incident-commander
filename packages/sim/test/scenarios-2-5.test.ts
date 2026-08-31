import { describe, it, expect } from "vitest";
import { materializeWorld, findOnsetMinute } from "../src/world.js";
import { INC_4822_SCENARIO, DECOY_DEPLOY_MINUTE } from "../src/scenarios/inc-4822-pool-exhaustion.js";
import { INC_4823_SCENARIO, STEP1_MINUTE, STEP2_MINUTE } from "../src/scenarios/inc-4823-pricing-flag.js";
import { INC_4824_SCENARIO, FIRST_OOM_MINUTE } from "../src/scenarios/inc-4824-memory-leak.js";
import { INC_4825_SCENARIO } from "../src/scenarios/inc-4825-provider-outage.js";

function series(world: ReturnType<typeof materializeWorld>, service: string, metric: string) {
  return world.metrics.find((m) => m.service === service && m.metric === metric)!;
}

describe("INC-4822 — the decoy-deploy falsifiers actually hold", () => {
  const world = materializeWorld(INC_4822_SCENARIO, 7, INC_4822_SCENARIO.defaultNowMinute);

  it("checkout's onset precedes the decoy payments-v7 deploy", () => {
    const onset = findOnsetMinute(series(world, "checkout", "error_rate"));
    expect(onset).not.toBeNull();
    expect(onset!).toBeLessThan(DECOY_DEPLOY_MINUTE);
  });

  it("auth degrades too, even though auth was never deployed — the second falsifier", () => {
    const onset = findOnsetMinute(series(world, "auth", "error_rate"));
    expect(onset).not.toBeNull();
    expect(onset!).toBeLessThan(DECOY_DEPLOY_MINUTE);
  });

  it("failing traces occur on both payments-v6 and payments-v7 — the third falsifier", () => {
    const failing = world.traces.filter((t) => t.status === "error" && t.failingSpanId);
    const versions = new Set(
      failing.map((t) => {
        const span = t.spans.find((s) => s.spanId === t.failingSpanId);
        return span?.attributes.deployment;
      })
    );
    expect(versions.has("payments-v6")).toBe(true);
    expect(versions.has("payments-v7")).toBe(true);
  });

  it("database liveness (cpu) stays normal — it is starved, not overloaded", () => {
    const cpu = series(world, "database", "cpu");
    expect(cpu.points[cpu.points.length - 1].value).toBeLessThan(0.6);
  });
});

describe("INC-4823 — the staircase matches each rollout stage", () => {
  const world = materializeWorld(INC_4823_SCENARIO, 11, INC_4823_SCENARIO.defaultNowMinute);
  const err = series(world, "checkout", "error_rate");

  it("sits near the first step's value between the two flag changes", () => {
    const point = err.points.find((p) => p.minute === STEP2_MINUTE - 1)!;
    expect(point.value).toBeGreaterThan(0.02);
    expect(point.value).toBeLessThan(0.08);
  });

  it("sits near the second, much higher step after the flag reaches 100%", () => {
    const point = err.points[err.points.length - 1];
    expect(point.value).toBeGreaterThan(0.3);
  });

  it("perfectly separates failing vs. succeeding traces on flag state", () => {
    // Between the two flag changes (50% rollout), not everyone is enrolled yet,
    // so both outcomes coexist — the window worth checking for a real mix. Once
    // rollout hits 100%, everyone is enrolled and *should* fail; that's correct,
    // not a bug, so it isn't what this test is checking.
    const traces = world.traces.filter((t) => t.minute >= STEP1_MINUTE && t.minute < STEP2_MINUTE);
    const failing = traces.filter((t) => t.status === "error");
    const succeeding = traces.filter((t) => t.status === "ok");
    for (const t of failing) {
      const span = t.spans.find((s) => s.spanId === t.failingSpanId)!;
      expect(span.attributes["flag.new_checkout_pricing"]).toBe(true);
    }
    // Not every trace need be sampled in both buckets at every minute, but across
    // the whole window we should see both — otherwise the "perfect separation"
    // evidence fingerprint (plan §5.3) isn't actually present in the data.
    expect(failing.length).toBeGreaterThan(0);
    expect(succeeding.length).toBeGreaterThan(0);
  });

  it("the checkout deployment is outside the default recent-deployments window", () => {
    const cutoffMinute = INC_4823_SCENARIO.defaultNowMinute - 120;
    for (const d of INC_4823_SCENARIO.deployments) {
      expect(d.deployedAtMinute).toBeLessThan(cutoffMinute);
    }
  });
});

describe("INC-4824 — rising floor, no dominant failing span", () => {
  const world = materializeWorld(INC_4824_SCENARIO, 3, INC_4824_SCENARIO.defaultNowMinute);
  const memory = series(world, "notifications", "memory");

  it("memory near the first OOM minute is much higher than at the start of the window", () => {
    const start = memory.points[0].value;
    const nearOom = memory.points.find((p) => p.minute === FIRST_OOM_MINUTE - 1)!.value;
    expect(nearOom).toBeGreaterThan(start * 1.5);
  });

  it("never resets anywhere near the original baseline after the first cycle", () => {
    const afterFirstCycle = memory.points.filter((p) => p.minute > FIRST_OOM_MINUTE);
    for (const p of afterFirstCycle) expect(p.value).toBeGreaterThan(0.5);
  });

  it("gc_pause_ms and queue_depth both climb monotonically-ish toward the window's end", () => {
    const gc = series(world, "notifications", "gc_pause_ms");
    const depth = series(world, "queue", "queue_depth");
    expect(gc.points[gc.points.length - 1].value).toBeGreaterThan(gc.points[0].value * 10);
    expect(depth.points[depth.points.length - 1].value).toBeGreaterThan(depth.points[0].value * 10);
  });

  it("no single span accounts for a dominant share of failing traces", () => {
    const failing = world.traces.filter((t) => t.status === "error" && t.failingSpanId);
    expect(failing.length).toBeGreaterThan(0);
    const byName = new Map<string, number>();
    for (const t of failing) {
      const span = t.spans.find((s) => s.spanId === t.failingSpanId)!;
      byName.set(span.name, (byName.get(span.name) ?? 0) + 1);
    }
    const max = Math.max(...byName.values());
    expect(max / failing.length).toBeLessThan(0.8);
  });
});

describe("INC-4825 — everything we own is healthy; the boundary span fails", () => {
  const world = materializeWorld(INC_4825_SCENARIO, 5, INC_4825_SCENARIO.defaultNowMinute);

  it("external call error rate is high while internal cpu/memory stay normal", () => {
    const external = series(world, "payments", "external_call_error_rate");
    const cpu = series(world, "payments", "cpu");
    const memory = series(world, "payments", "memory");
    expect(external.points[external.points.length - 1].value).toBeGreaterThan(0.5);
    expect(cpu.points[cpu.points.length - 1].value).toBeLessThan(0.6);
    expect(memory.points[memory.points.length - 1].value).toBeLessThan(0.6);
  });

  it("has no deployments or changes at all — nothing of ours moved", () => {
    expect(INC_4825_SCENARIO.deployments.length).toBe(0);
    expect(INC_4825_SCENARIO.changes.length).toBe(0);
  });

  it("every failing trace fails at the provider boundary span, nowhere earlier", () => {
    const failing = world.traces.filter((t) => t.status === "error");
    expect(failing.length).toBeGreaterThan(0);
    for (const t of failing) {
      const span = t.spans.find((s) => s.spanId === t.failingSpanId)!;
      expect(span.name).toBe("payments.http.northwind-pay");
    }
  });
});
