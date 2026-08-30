import type { SessionState } from "../store/session.js";

// Phase 1's hero scenario has no runbooks (runbookIds: []) — INC-4825 (Phase 8)
// is the scenario that actually needs one. This endpoint is real, not a stub;
// it just has nothing to return yet for the current scenario, and says so.
const RUNBOOKS: Record<string, unknown> = {};

export function getRunbook(_session: SessionState, symptom: string | null, service: string | null, runbookId: string | null) {
  if (runbookId) {
    const rb = RUNBOOKS[runbookId];
    if (!rb) return { status: 404, body: { error: `No runbook "${runbookId}".` } };
    return { status: 200, body: { runbook: rb } };
  }
  return {
    status: 200,
    body: {
      runbooks: [],
      note: `No runbooks match${symptom ? ` symptom "${symptom}"` : ""}${service ? ` for service "${service}"` : ""}.`,
    },
  };
}
