import type { Incident, EvidenceRef } from "@incident-commander/shared";

export type ConfidenceLevel = "Strong" | "Moderate" | "Weak";

export interface ConfidenceResult {
  level: ConfidenceLevel;
  supportingSignals: number;
  alternativesFalsified: number;
  unexplainedObservations: number;
}

const UNCERTAINTY_MARKERS = [
  "unclear",
  "uncertain",
  "unexplained",
  "weak correlation",
  "does not fully explain",
  "cannot confirm",
  "not confident",
];

/**
 * Plan §9.2: "counted from attached evidence, not self-reported" — never a
 * fabricated probability. All three counts come from what the agent actually
 * wrote and cited, not from ground truth the console must never see (plan
 * §3.9): `supportingSignals` is the number of distinct evidence *kinds* the
 * agent has cited across its own notes; `alternativesFalsified` approximates
 * "the agent ruled something out" by counting distinct deployment/change
 * citations (falsifying a hypothesis almost always means pointing at a
 * specific deploy or change and showing it doesn't fit); `unexplainedObservations`
 * counts notes where the agent's own words admit uncertainty — which rewards
 * exactly the honest-uncertainty behavior plan §5.4 (INC-4824) is testing for,
 * rather than penalizing it.
 */
export function computeConfidence(incident: Incident): ConfidenceResult {
  const allRefs: EvidenceRef[] = incident.notes.flatMap((n) => n.evidenceRefs);
  const kinds = new Set(allRefs.map((r) => r.kind));
  const supportingSignals = kinds.size;

  const falsifiedKinds = new Set(allRefs.filter((r) => r.kind === "deployment" || r.kind === "change").map((r) => r.id));
  const alternativesFalsified = falsifiedKinds.size;

  const unexplainedObservations = incident.notes.filter((n) => {
    const lower = n.note.toLowerCase();
    return UNCERTAINTY_MARKERS.some((marker) => lower.includes(marker));
  }).length;

  let level: ConfidenceLevel = "Weak";
  if (supportingSignals === 0) {
    level = "Weak";
  } else if (unexplainedObservations > 0 || alternativesFalsified === 0) {
    level = "Moderate";
  } else if (supportingSignals >= 3 && alternativesFalsified >= 1) {
    level = "Strong";
  } else {
    level = "Moderate";
  }

  return { level, supportingSignals, alternativesFalsified, unexplainedObservations };
}
