import { describe, it, expect } from "vitest";
import { materializeWorld, findOnsetMinute } from "../src/world.js";
import {
  HERO_CHECKOUT_SCENARIO,
  NOW_MINUTE,
  DEPLOY_MINUTE,
  ONSET_MINUTE,
  PAYMENTS_SPIKE_MINUTE,
} from "../src/scenarios/hero-checkout.js";

const world = materializeWorld(HERO_CHECKOUT_SCENARIO, 42, NOW_MINUTE);

function series(service: string, metric: string) {
  return world.metrics.find((m) => m.service === service && m.metric === metric)!;
}

describe("correlation contract (plan §14.3)", () => {
  it("puts checkout's error-rate onset strictly after the deploy, not before or coincident", () => {
    const onset = findOnsetMinute(series("checkout", "error_rate"));
    expect(onset).not.toBeNull();
    expect(onset).toBeGreaterThan(DEPLOY_MINUTE);
    expect(onset).toBe(ONSET_MINUTE);
  });

  it("puts payments' onset strictly after checkout's — falsifying the 'blame payments' hypothesis", () => {
    const checkoutOnset = findOnsetMinute(series("checkout", "error_rate"))!;
    const paymentsOnset = findOnsetMinute(series("payments", "error_rate"))!;
    expect(paymentsOnset).toBeGreaterThan(checkoutOnset);
    expect(paymentsOnset).toBe(PAYMENTS_SPIKE_MINUTE);
  });

  it("would break silently if a future edit collapsed the checkout/payments onset gap to zero", () => {
    // This is the guard the plan's §14.3 warns about: if someone edits the phase
    // definitions and the gap disappears, the incident stops being solvable by
    // evidence alone. Asserting a minimum gap (not just "greater than") catches that.
    const checkoutOnset = findOnsetMinute(series("checkout", "error_rate"))!;
    const paymentsOnset = findOnsetMinute(series("payments", "error_rate"))!;
    expect(paymentsOnset - checkoutOnset).toBeGreaterThanOrEqual(2);
  });

  it("keeps checkout's latency series free of any onset at all — it is not part of the evidence", () => {
    expect(findOnsetMinute(series("checkout", "latency_p95"))).toBeNull();
  });
});
