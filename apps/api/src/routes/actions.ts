import { resolveAction, getScenario } from "../simEngine.js";
import type { SessionState } from "../store/session.js";
import { appendAudit } from "../audit/log.js";
import { canMutate } from "../authz/roles.js";
import { consumeApprovalForAction } from "./approvals.js";

/**
 * Phase 2 scope boundary, deliberate: this checks approval validity + action
 * binding + role, resolves the remediation rule (plan §4.6, built in Phase 1),
 * and audits the outcome — the full authorization path. It does NOT yet make
 * `materializeWorld` reflect an executed remediation (e.g. checkout-v3's
 * rollback visibly lowering error_rate on the next poll). That requires
 * extending world derivation with executed-action awareness, which is Phase
 * 6's job per phase.md ("Action tools and the remediation model... Approval
 * flow... execute, binding, consumption") — the recovery curve returned here
 * is what Phase 6's client-side animation (plan §2.2) will consume.
 */
function runGatedAction(
  session: SessionState,
  tool: string,
  args: Record<string, unknown> & { approvalId?: string }
): { session: SessionState; response: { status: number; body: unknown } } {
  if (!canMutate(session.role)) {
    return { session, response: { status: 403, body: { error: "Observer role cannot execute actions." } } };
  }

  const { approvalId, ...actionArgs } = args;
  if (!approvalId) {
    return { session, response: { status: 400, body: { error: "approvalId is required — call request_approval first." } } };
  }

  const consumption = consumeApprovalForAction(session, approvalId, tool, actionArgs);
  if (!consumption.ok) {
    const next = appendAudit(session, { tool, args: actionArgs, approvalId, outcome: "denied", denialReason: consumption.reason, resultSummary: "denied" });
    return { session: next, response: { status: 403, body: { error: consumption.reason } } };
  }

  const scenario = getScenario(session.scenarioId);
  const rule = resolveAction(scenario, tool, actionArgs);

  let next = consumption.session;
  next = appendAudit(next, {
    tool,
    args: actionArgs,
    approvalId,
    outcome: rule.effect === "rejected" ? "error" : "allowed",
    resultSummary: rule.message,
  });

  const status = rule.effect === "rejected" ? 409 : 200;
  return { session: next, response: { status, body: { effect: rule.effect, message: rule.message, recoveryCurve: rule.recoveryCurve ?? null } } };
}

export function rollbackDeployment(session: SessionState, args: Record<string, unknown> & { approvalId?: string }) {
  return runGatedAction(session, "rollback_deployment", args);
}
export function restartService(session: SessionState, args: Record<string, unknown> & { approvalId?: string }) {
  return runGatedAction(session, "restart_service", args);
}
export function scaleService(session: SessionState, args: Record<string, unknown> & { approvalId?: string }) {
  return runGatedAction(session, "scale_service", args);
}
export function disableFeatureFlag(session: SessionState, args: Record<string, unknown> & { approvalId?: string }) {
  return runGatedAction(session, "disable_feature_flag", args);
}
