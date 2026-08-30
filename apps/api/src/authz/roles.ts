import type { Role } from "../sharedTypes.js";

/**
 * Plan §8.1 only specifies one hard boundary at this layer: observer never
 * gets a mutating tool surface at all. It does not specify a stricter
 * responder-cannot-approve separation of duties, so this stays permissive
 * between responder/approver — both can mutate and both can decide approvals.
 * A stricter split is a Phase 6+ refinement if the demo wants to show one,
 * not something this phase's plan sections require.
 */
export function canMutate(role: Role): boolean {
  return role !== "observer";
}

export function canDecideApproval(role: Role): boolean {
  return role !== "observer";
}
