import type { Approval, EvidenceRef, Risk, TimelineEvent } from "../sharedTypes.js";
import { isoForMinute } from "../simEngine.js";
import type { SessionState } from "../store/session.js";
import { appendAudit } from "../audit/log.js";
import { canMutate, canDecideApproval } from "../authz/roles.js";
import { actionHash } from "../authz/actionBinding.js";
import { issueApprovalToken } from "../authz/approvalToken.js";

export function getPendingApprovals(session: SessionState, incidentId: string | null) {
  let approvals = session.approvals.filter((a) => a.status === "pending");
  if (incidentId) approvals = approvals.filter((a) => a.incidentId === incidentId);
  return { status: 200, body: { approvals } };
}

/**
 * Console-only — called when the approval card renders, NEVER a registered
 * WebMCP tool. This is the entire security property from plan §12.3: an agent
 * has no path to this endpoint, so it can never obtain a token to hand back
 * to record_approval itself.
 */
export async function issueNonceForApproval(session: SessionState, approvalId: string): Promise<{ status: number; body: unknown }> {
  const approval = session.approvals.find((a) => a.id === approvalId);
  if (!approval) return { status: 404, body: { error: `No approval "${approvalId}".` } };
  if (approval.status !== "pending") return { status: 409, body: { error: `Approval "${approvalId}" is already ${approval.status}.` } };
  const token = await issueApprovalToken(approvalId, session.sessionId);
  return { status: 200, body: { approvalToken: token } };
}

export interface RequestApprovalInput {
  incidentId?: string;
  tool?: string;
  args?: Record<string, unknown>;
  reason?: string;
  evidenceRefs?: EvidenceRef[];
  expectedEffect?: string;
  notCovered?: string;
  risk?: Risk;
}

const GATED_TOOLS = ["rollback_deployment", "restart_service", "scale_service", "disable_feature_flag"];

export function requestApproval(
  session: SessionState,
  input: RequestApprovalInput
): { session: SessionState; response: { status: number; body: unknown } } {
  if (!canMutate(session.role)) {
    return { session, response: { status: 403, body: { error: "Observer role cannot request approvals." } } };
  }
  const missing = (["incidentId", "tool", "args", "reason", "evidenceRefs", "expectedEffect", "notCovered", "risk"] as const).filter(
    (k) => input[k] === undefined
  );
  if (missing.length > 0) {
    return { session, response: { status: 400, body: { error: `Missing required fields: ${missing.join(", ")}.` } } };
  }
  if (!GATED_TOOLS.includes(input.tool!)) {
    return { session, response: { status: 400, body: { error: `"${input.tool}" is not a gated action; it does not require approval.` } } };
  }
  const incident = session.incidents.find((i) => i.id === input.incidentId);
  if (!incident) return { session, response: { status: 404, body: { error: `No incident "${input.incidentId}".` } } };

  const id = `approval-${session.seq + 1}`;
  const approval: Approval = {
    id,
    incidentId: input.incidentId!,
    requestedAtMinute: session.nowMinute,
    requestedAt: isoForMinute(session.nowMinute),
    requestedBy: "agent",
    action: { tool: input.tool!, args: input.args! },
    reason: input.reason!,
    evidenceRefs: input.evidenceRefs!,
    expectedEffect: input.expectedEffect!,
    notCovered: input.notCovered!,
    risk: input.risk!,
    status: "pending",
    decidedAt: null,
    decidedBy: null,
    decisionNote: null,
    consumedAt: null,
  };

  const timelineEntry: TimelineEvent = { atMinute: session.nowMinute, at: isoForMinute(session.nowMinute), source: "agent", summary: `Proposed: ${input.tool} — awaiting human approval` };
  const updatedIncident = { ...incident, state: "WAITING_FOR_APPROVAL" as const, timeline: [...incident.timeline, timelineEntry] };

  let next: SessionState = {
    ...session,
    approvals: [...session.approvals, approval],
    incidents: session.incidents.map((i) => (i.id === updatedIncident.id ? updatedIncident : i)),
  };
  next = appendAudit(next, { tool: "request_approval", args: input as Record<string, unknown>, outcome: "allowed", resultSummary: `Requested approval ${id} for ${input.tool}` });

  return { session: next, response: { status: 200, body: { approvalId: id, status: "pending" } } };
}

/**
 * Applies a human decision. `tokenValid` is resolved BEFORE this runs (it needs
 * an async Blobs read against the separate approval-tokens store — see
 * authz/approvalToken.ts) and passed in, so this function itself stays pure
 * and synchronous, matching store/blobs.ts's readModifyWrite contract. If a
 * write race forces a retry, reusing the same already-computed tokenValid is
 * correct: token validity doesn't depend on session state, and a single-use
 * token was already consumed by the time we get here either way.
 */
export function applyApprovalDecision(
  session: SessionState,
  input: { approvalId?: string; decision?: "approved" | "rejected"; decisionNote?: string },
  tokenValid: boolean
): { session: SessionState; response: { status: number; body: unknown } } {
  if (!input.approvalId || !input.decision) {
    return { session, response: { status: 400, body: { error: "approvalId and decision are required." } } };
  }
  if (!canDecideApproval(session.role)) {
    return { session, response: { status: 403, body: { error: "Observer role cannot decide approvals." } } };
  }

  const approval = session.approvals.find((a) => a.id === input.approvalId);
  if (!approval) return { session, response: { status: 404, body: { error: `No approval "${input.approvalId}".` } } };

  if (!tokenValid) {
    const denialReason = "Approval token missing or invalid. Approvals require a human action in the console.";
    const next = appendAudit(session, { tool: "record_approval", args: input as Record<string, unknown>, approvalId: input.approvalId, outcome: "denied", denialReason, resultSummary: "denied", actorKind: "agent" });
    return { session: next, response: { status: 403, body: { error: denialReason, auditSeq: next.seq } } };
  }

  if (approval.status !== "pending") {
    return { session, response: { status: 409, body: { error: `Approval "${input.approvalId}" is already ${approval.status}.` } } };
  }

  const decided: Approval = { ...approval, status: input.decision, decidedAt: isoForMinute(session.nowMinute), decidedBy: "console-user", decisionNote: input.decisionNote ?? null };
  let next: SessionState = { ...session, approvals: session.approvals.map((a) => (a.id === decided.id ? decided : a)) };
  next = appendAudit(next, { tool: "record_approval", args: input as Record<string, unknown>, approvalId: input.approvalId, outcome: "allowed", resultSummary: `Approval ${input.approvalId} ${input.decision}`, actorKind: "human" });

  return { session: next, response: { status: 200, body: { ok: true, status: decided.status } } };
}

/** Consumed by the action endpoints (routes/actions.ts) before executing a gated action. */
export function consumeApprovalForAction(
  session: SessionState,
  approvalId: string,
  tool: string,
  args: Record<string, unknown>
): { ok: true; session: SessionState } | { ok: false; reason: string } {
  const approval = session.approvals.find((a) => a.id === approvalId);
  if (!approval) return { ok: false, reason: `No approval "${approvalId}".` };
  if (approval.status !== "approved") return { ok: false, reason: `Approval "${approvalId}" is not approved (status: ${approval.status}).` };
  if (approval.consumedAt) return { ok: false, reason: `Approval "${approvalId}" was already used.` };
  if (approval.action.tool !== tool || actionHash(approval.action.tool, approval.action.args) !== actionHash(tool, args)) {
    return { ok: false, reason: `Approval "${approvalId}" does not match this exact action and arguments.` };
  }
  const consumed = { ...approval, consumedAt: isoForMinute(session.nowMinute) };
  return { ok: true, session: { ...session, approvals: session.approvals.map((a) => (a.id === consumed.id ? consumed : a)) } };
}
