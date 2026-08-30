import { describe, it, expect } from "vitest";
import { computeBaseValue } from "../src/generators/metrics.js";
import type { Phase } from "../src/types.js";

function phase(overrides: Partial<Phase>): Phase {
  return {
    fromMinute: 0,
    toMinute: 10,
    service: "checkout",
    metric: "error_rate",
    shape: "noise_only",
    from: 1,
    to: 1,
    jitter: 0,
    ...overrides,
  };
}

describe("phase shapes (plan §4.4) — pure math, no rng", () => {
  it("noise_only holds at `from` for the whole window", () => {
    const p = phase({ shape: "noise_only", from: 5, to: 999 });
    expect(computeBaseValue(p, 0)).toBe(5);
    expect(computeBaseValue(p, 10)).toBe(5);
  });

  it("step returns `to` for the entire window — the jump already happened by construction", () => {
    const p = phase({ shape: "step", from: 1, to: 9 });
    expect(computeBaseValue(p, 0)).toBe(9);
    expect(computeBaseValue(p, 10)).toBe(9);
  });

  it("ramp interpolates linearly from `from` to `to`", () => {
    const p = phase({ shape: "ramp", fromMinute: 0, toMinute: 10, from: 0, to: 100 });
    expect(computeBaseValue(p, 0)).toBe(0);
    expect(computeBaseValue(p, 5)).toBe(50);
    expect(computeBaseValue(p, 10)).toBe(100);
  });

  it("staircase jumps in discrete steps rather than interpolating smoothly", () => {
    const p = phase({ shape: "staircase", fromMinute: 0, toMinute: 10, from: 0, to: 30, params: { steps: 3 } });
    const values = [0, 3, 6, 9, 12].map((m) => computeBaseValue(p, m));
    const distinctValues = new Set(values);
    // Only 3 distinct plateaus should appear across the sampled minutes, not 5.
    expect(distinctValues.size).toBeLessThanOrEqual(3);
    expect(computeBaseValue(p, 0)).toBe(0);
    expect(computeBaseValue(p, 10)).toBe(30);
  });

  it("sawtooth rises within each cycle and resets at the cycle boundary", () => {
    const p = phase({ shape: "sawtooth", fromMinute: 0, toMinute: 100, from: 0, to: 10, params: { periodMinutes: 10 } });
    expect(computeBaseValue(p, 0)).toBe(0);
    expect(computeBaseValue(p, 5)).toBe(5);
    // Just after the reset boundary, value must have dropped back down, not kept climbing.
    expect(computeBaseValue(p, 10)).toBeLessThan(computeBaseValue(p, 9));
  });

  it("sawtooth with a rising floor never fully resets to the original baseline", () => {
    const p = phase({
      shape: "sawtooth",
      fromMinute: 0,
      toMinute: 100,
      from: 0,
      to: 10,
      params: { periodMinutes: 10, floorRisePerCycle: 2 },
    });
    const secondCycleStart = computeBaseValue(p, 10);
    const thirdCycleStart = computeBaseValue(p, 20);
    expect(secondCycleStart).toBeGreaterThan(0);
    expect(thirdCycleStart).toBeGreaterThan(secondCycleStart);
  });

  it("spike_train is quiet most of the time and briefly spikes each period", () => {
    const p = phase({
      shape: "spike_train",
      fromMinute: 0,
      toMinute: 100,
      from: 1,
      to: 50,
      params: { periodMinutes: 10, spikeWidthMinutes: 1 },
    });
    expect(computeBaseValue(p, 0)).toBe(50);
    expect(computeBaseValue(p, 1)).toBe(1);
    expect(computeBaseValue(p, 5)).toBe(1);
    expect(computeBaseValue(p, 10)).toBe(50);
  });
});
