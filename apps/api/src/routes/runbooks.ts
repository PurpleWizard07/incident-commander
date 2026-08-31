import type { Runbook, ServiceId } from "../sharedTypes.js";
import type { SessionState } from "../store/session.js";

// Phase 1's hero scenario had no runbooks (runbookIds: []). INC-4825 (Phase 8)
// is the scenario that actually needs one — RB-014 is real content, not a
// placeholder, and is the specific artifact that scenario's ground truth
// depends on the agent finding (plan §5.5: "this flag exists but is not
// obvious; finding it requires reading the runbook").
const RUNBOOKS: Record<string, Runbook> = {
  "RB-014": {
    id: "RB-014",
    title: "Third-party payment provider degradation",
    symptoms: [
      "payment provider errors",
      "502 bad gateway",
      "upstream provider failure",
      "circuit breaker open",
      "provider timeout",
    ],
    services: ["payments"],
    steps: [
      {
        n: 1,
        text: "Confirm the failure is at the provider boundary, not our own code — check the failing span in search_traces.",
        toolHint: "search_traces",
      },
      {
        n: 2,
        text: "If a fallback payment provider is available, route to it by disabling require_primary_provider.",
        toolHint: "disable_feature_flag",
      },
      {
        n: 3,
        text: "If no fallback exists, escalate to the vendor and communicate status — do not restart or scale our own services; the provider is what's down.",
        toolHint: null,
      },
      {
        n: 4,
        text: "Document the provider outage and assign the incident. Do not resolve until the provider itself recovers.",
        toolHint: "add_incident_note",
      },
    ],
    lastReviewed: "2026-06-01T00:00:00.000Z",
  },
};

function matches(rb: Runbook, symptomLower: string | undefined, service: string | null): boolean {
  const symptomMatch =
    !symptomLower || rb.symptoms.some((s) => s.toLowerCase().includes(symptomLower) || symptomLower.includes(s.toLowerCase()));
  const serviceMatch = !service || rb.services.includes(service as ServiceId);
  return symptomMatch && serviceMatch;
}

export function getRunbook(_session: SessionState, symptom: string | null, service: string | null, runbookId: string | null) {
  if (runbookId) {
    const rb = RUNBOOKS[runbookId];
    if (!rb) return { status: 404, body: { error: `No runbook "${runbookId}".` } };
    return { status: 200, body: { runbook: rb } };
  }

  const candidates = Object.values(RUNBOOKS).filter((rb) => matches(rb, symptom?.toLowerCase(), service));
  if (candidates.length === 0) {
    return {
      status: 200,
      body: {
        runbooks: [],
        note: `No runbooks match${symptom ? ` symptom "${symptom}"` : ""}${service ? ` for service "${service}"` : ""}.`,
      },
    };
  }
  if (candidates.length === 1) return { status: 200, body: { runbook: candidates[0] } };
  return { status: 200, body: { runbooks: candidates } };
}
