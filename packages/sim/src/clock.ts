/**
 * Virtual clock (plan §4.1). Generation is a pure function of minute offsets
 * from a FIXED epoch, never real wall-clock time — that is what keeps
 * materializeWorld() byte-identical across runs and across days. The epoch's
 * calendar date is flavor text only; nothing depends on it being "today".
 *
 * This module is deliberately just the epoch and the one direction of
 * conversion the generators actually need. An earlier draft also exported
 * `minuteForIso`, `ClockMode`, `SimClock` and `TICK_MS_BY_MODE` — a clock
 * *state* model that nothing ever adopted: the API resolves the session clock
 * itself from fixed anchors (`apps/api/src/store/session.ts`), and the console
 * reads the mode off incident state. Removed rather than left as a second,
 * unused description of how time works here.
 */
export const SIM_EPOCH_ISO = "2026-08-30T09:19:00.000Z";

const SIM_EPOCH_MS = Date.parse(SIM_EPOCH_ISO);

export function isoForMinute(minute: number): string {
  return new Date(SIM_EPOCH_MS + minute * 60_000).toISOString();
}
