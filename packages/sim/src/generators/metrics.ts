import type { MetricName, MetricPoint, MetricSeries, ServiceId } from "@incident-commander/shared";
import { isoForMinute } from "../clock.js";
import type { Phase } from "../types.js";
import type { Rng } from "../prng.js";

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Pure shape math for one phase at one minute — no jitter, no rng. */
export function computeBaseValue(phase: Phase, minute: number): number {
  const span = Math.max(1, phase.toMinute - phase.fromMinute);
  const progress = clamp((minute - phase.fromMinute) / span, 0, 1);

  switch (phase.shape) {
    case "noise_only":
      return phase.from;
    case "step":
      return phase.to;
    case "ramp":
      return phase.from + (phase.to - phase.from) * progress;
    case "staircase": {
      const steps = Math.max(1, phase.params?.steps ?? 4);
      const stepIndex = Math.min(steps - 1, Math.floor(progress * steps));
      const stepProgress = steps <= 1 ? 1 : stepIndex / (steps - 1);
      return phase.from + (phase.to - phase.from) * stepProgress;
    }
    case "sawtooth": {
      const cycleLen = Math.max(1, phase.params?.periodMinutes ?? span);
      const elapsed = Math.max(0, minute - phase.fromMinute);
      const cycleIndex = Math.floor(elapsed / cycleLen);
      const posInCycle = elapsed - cycleIndex * cycleLen;
      const floorRise = phase.params?.floorRisePerCycle ?? 0;
      const floor = phase.from + floorRise * cycleIndex;
      const cycleProgress = posInCycle / cycleLen;
      return floor + (phase.to - floor) * cycleProgress;
    }
    case "spike_train": {
      const cycleLen = Math.max(1, phase.params?.periodMinutes ?? 10);
      const width = phase.params?.spikeWidthMinutes ?? 1;
      const elapsed = Math.max(0, minute - phase.fromMinute);
      const posInCycle = elapsed % cycleLen;
      return posInCycle < width ? phase.to : phase.from;
    }
  }
}

function precisionFor(metric: MetricName): number {
  return metric === "error_rate" || metric === "db_pool_utilization" || metric === "external_call_error_rate"
    ? 4
    : 1;
}

function roundTo(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

function pickActivePhase(sortedPhases: Phase[], minute: number): Phase | null {
  let active: Phase | null = null;
  for (const p of sortedPhases) {
    if (p.fromMinute <= minute) active = p;
  }
  return active;
}

/**
 * Builds one MetricSeries for (service, metric) over [fromMinute, toMinute],
 * evaluating whichever phase is active at each minute and applying jitter.
 * Returns null if no phase touches this (service, metric) pair at all —
 * callers use that to report absence explicitly rather than a fake zero
 * (plan §3.3).
 */
export function buildMetricSeries(
  allPhases: Phase[],
  service: ServiceId,
  metric: MetricName,
  unit: string,
  baseline: number,
  fromMinute: number,
  toMinute: number,
  rng: Rng
): MetricSeries | null {
  const relevant = allPhases
    .filter((p) => p.service === service && p.metric === metric)
    .sort((a, b) => a.fromMinute - b.fromMinute);
  if (relevant.length === 0) return null;

  const points: MetricPoint[] = [];
  for (let minute = fromMinute; minute <= toMinute; minute++) {
    const active = pickActivePhase(relevant, minute);
    const base = active ? computeBaseValue(active, minute) : baseline;
    const jitterFrac = active && active.jitter > 0 ? rng.range(-active.jitter, active.jitter) : 0;
    const value = Math.max(0, base * (1 + jitterFrac));
    points.push({ t: isoForMinute(minute), minute, value: roundTo(value, precisionFor(metric)) });
  }

  return { service, metric, unit, points, baseline };
}
