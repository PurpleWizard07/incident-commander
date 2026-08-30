import type { Incident, TimelineEvent } from "../sharedTypes.js";
import { resolveAction, getScenario, isoForMinute } from "../simEngine.js";
import type { SessionState } from "../store/session.js";
import { appendAudit } from "../audit/log.js";
import { canMutate } from "../authz/roles.js";
import { consumeApprovalForAction } from "./approvals.js";

/**
 * Phase 6: extends Phase 2's authorization path (approval validity, action
 * binding, role, audit) with the incident-state machine (plan §7) and the
 * executed-remediation record `store/session.ts` uses to make subsequent
 * polls/tool calls actually observe recovery — see that file's and
 * phase-summary.md's Phase 6 entries for how the clock/metric blend works.
 *
 * `recoveryMetric` is hardcoded to `error_rate`: the hero scenario's own
 * remediation messages and approval-card copy ("checkout error rate returns
 * to baseline... payments recovers in tandem") only ever describe error
 * rate recovering, and `RemediationRule` doesn't name a metric — a
 * deliberate Phase 6 simplification, not an oversight.
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
  const approval = consumption.session.approvals.find((a) => a.id === approvalId);
  const incident = approval ? consumption.session.incidents.find((i) => i.id === approval.incidentId) : undefined;

  let next = consumption.session;

  if (incident) {
    const nowMinute = next.nowMinute;
    if (rule.effect === "rejected") {
      // The approval was consumed but nothing executed — nothing to recover
      // from. Send the incident back to investigation rather than leaving it
      // stranded in WAITING_FOR_APPROVAL with no pending approval left.
      const entry: TimelineEvent = { atMinute: nowMinute, at: isoForMinute(nowMinute), source: "system", summary: `${tool} rejected: ${rule.message}` };
      const updated: Incident = { ...incident, state: "INVESTIGATING", timeline: [...incident.timeline, entry] };
      next = { ...next, incidents: next.incidents.map((i) => (i.id === updated.id ? updated : i)) };
    } else {
      const entry: TimelineEvent = { atMinute: nowMinute, at: isoForMinute(nowMinute), source: "agent", summary: `Executed ${tool}: ${rule.message}` };
      const updated: Incident = { ...incident, state: "RECOVERING", timeline: [...incident.timeline, entry] };
      next = {
        ...next,
        incidents: next.incidents.map((i) => (i.id === updated.id ? updated : i)),
        executedRemediation: {
          incidentId: incident.id,
          tool,
          effect: rule.effect,
          recoveryServices: incident.affectedServices,
          recoveryMetric: "error_rate",
          recoveryCurve: rule.recoveryCurve ?? null,
          executedAtMinute: nowMinute,
          executedAtRealMs: Date.now(),
        },
      };
    }
  }

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
