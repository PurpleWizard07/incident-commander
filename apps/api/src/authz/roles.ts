import type { Role } from "../sharedTypes.js";

/**
 * There is exactly one boundary at this layer, and it is plan §8.1's:
 * `observer` never gets a mutating tool surface at all; `responder` has full
 * authority.
 *
 * A third `approver` role existed until 2026-09-03 and was removed. It was
 * indistinguishable from `responder` — both predicates below are
 * `!== "observer"` — so the console offered a switch position that changed
 * nothing while implying a separation of duties the code never enforced.
 * The real boundary on approvals is not role-vs-role: it is the human
 * gesture, since the decide endpoint requires an `isTrusted`-minted approval
 * token an agent cannot forge (docs/SECURITY.md). A role named "approver"
 * pointed attention away from that. See phase-summary.md's 2026-09-03 entry.
 *
 * The two predicates stay separate despite sharing a body: they answer
 * different questions, and the call sites read correctly because of it.
 */
export function canMutate(role: Role): boolean {
  return role !== "observer";
}

export function canDecideApproval(role: Role): boolean {
  return role !== "observer";
}
