/**
 * Virtual clock (plan §4.1). Generation is a pure function of minute offsets
 * from a FIXED epoch, never real wall-clock time — that is what keeps
 * materializeWorld() byte-identical across runs and across days. The epoch's
 * calendar date is flavor text only; nothing depends on it being "today".
 */
export const SIM_EPOCH_ISO = "2026-08-30T09:19:00.000Z";

const SIM_EPOCH_MS = Date.parse(SIM_EPOCH_ISO);

export function isoForMinute(minute: number): string {
  return new Date(SIM_EPOCH_MS + minute * 60_000).toISOString();
}

export function minuteForIso(iso: string): number {
  return (Date.parse(iso) - SIM_EPOCH_MS) / 60_000;
}

export type ClockMode = "frozen" | "live" | "accelerated";

export interface SimClock {
  startedAt: string;
  now: string;
  mode: ClockMode;
  tickMs: number;
}

export const TICK_MS_BY_MODE: Record<ClockMode, number> = {
  frozen: 0,
  live: 2_000,
  accelerated: 400,
};
