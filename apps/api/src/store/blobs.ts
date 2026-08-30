import { getStore } from "@netlify/blobs";

const STORE_NAME = "sessions";

function store() {
  return getStore(STORE_NAME);
}

/**
 * Read-modify-write with a best-effort optimistic conflict check.
 *
 * `modify` returns both the new state to persist AND an arbitrary `result` to
 * hand back to the caller — needed because most route handlers compute an
 * HTTP response (e.g. "approval already decided", or a newly created
 * incident's id) that depends on whatever state a given attempt actually saw,
 * and `readModifyWrite` may retry `modify` against fresher data if a race is
 * detected. Returning only the new state (an earlier version of this function
 * did) leaves no way to report that response back to the caller.
 *
 * Honest caveat: @netlify/blobs (as installed) has no atomic conditional write
 * (no `onlyIfMatch` on `set`/`setJSON`) — so this is NOT a true compare-and-swap.
 * It narrows the race window (re-checks the etag immediately before writing,
 * retries on a mismatch) but cannot close it completely. For this product that
 * is a proportionate tradeoff: a session corresponds to one responder's one
 * console tab talking to one agent, so genuinely concurrent writers to the
 * SAME session are not an expected case — the property that actually matters
 * (and *is* solid) is that DIFFERENT sessions never collide, since each has
 * its own key. See phase-summary.md's Phase 2 decisions log.
 */
export async function readModifyWrite<T, R>(
  key: string,
  fallback: () => T,
  modify: (current: T) => { next: T; result: R },
  attempts = 5
): Promise<R> {
  const s = store();

  for (let attempt = 0; attempt < attempts; attempt++) {
    const existing = await s.getWithMetadata(key, { type: "json", consistency: "strong" });
    const current: T = existing ? (existing.data as T) : fallback();
    const { next, result } = modify(current);

    const beforeWrite = await s.getMetadata(key, { consistency: "strong" });
    const raceDetected = existing ? beforeWrite?.etag !== existing.etag : beforeWrite !== null;
    if (raceDetected) continue; // someone else wrote between our read and now — retry with fresh data

    await s.setJSON(key, next);
    return result;
  }

  throw new Error(`readModifyWrite: too much write contention on key "${key}" after ${attempts} attempts`);
}

export async function readJSON<T>(key: string): Promise<T | null> {
  return store().get(key, { type: "json", consistency: "strong" });
}
