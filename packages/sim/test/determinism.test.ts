import { describe, it, expect } from "vitest";
import { materializeWorld } from "../src/world.js";
import { HERO_CHECKOUT_SCENARIO, NOW_MINUTE } from "../src/scenarios/hero-checkout.js";

describe("determinism (plan §14.1)", () => {
  it("produces a byte-identical world for the same (scenario, seed) across many runs", () => {
    const first = materializeWorld(HERO_CHECKOUT_SCENARIO, 42, NOW_MINUTE);
    const firstJson = JSON.stringify(first);

    for (let i = 0; i < 100; i++) {
      const world = materializeWorld(HERO_CHECKOUT_SCENARIO, 42, NOW_MINUTE);
      expect(JSON.stringify(world)).toBe(firstJson);
    }
  });

  it("produces a different world for a different seed", () => {
    const a = materializeWorld(HERO_CHECKOUT_SCENARIO, 1, NOW_MINUTE);
    const b = materializeWorld(HERO_CHECKOUT_SCENARIO, 2, NOW_MINUTE);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it("is a stable prefix as nowMinute grows — a past point never changes value on a later poll", () => {
    const early = materializeWorld(HERO_CHECKOUT_SCENARIO, 42, 50);
    const later = materializeWorld(HERO_CHECKOUT_SCENARIO, 42, NOW_MINUTE);

    const earlySeries = early.metrics.find((m) => m.service === "checkout" && m.metric === "error_rate")!;
    const laterSeries = later.metrics.find((m) => m.service === "checkout" && m.metric === "error_rate")!;
    expect(laterSeries.points.slice(0, 51)).toEqual(earlySeries.points);

    // Same property for traces and logs: minutes 0..50 must match byte-for-byte
    // even though `later` was asked to generate all the way to minute 93.
    const earlyTraces = early.traces.filter((t) => t.minute <= 50);
    const laterTracesUpTo50 = later.traces.filter((t) => t.minute <= 50);
    expect(laterTracesUpTo50).toEqual(earlyTraces);

    const earlyLogs = early.logs.filter((l) => l.minute <= 50);
    const laterLogsUpTo50 = later.logs.filter((l) => l.minute <= 50);
    expect(laterLogsUpTo50).toEqual(earlyLogs);
  });
});
