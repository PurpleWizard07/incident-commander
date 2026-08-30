import type { AuditRecord, AuditOutcome } from "../sharedTypes.js";
import { isoForMinute } from "../simEngine.js";
import type { SessionState } from "../store/session.js";

export interface AuditInput {
  tool: string;
  args: Record<string, unknown>;
  approvalId?: string | null;
  outcome: AuditOutcome;
  denialReason?: string | null;
  resultSummary: string;
  stateBefore?: string | null;
  stateAfter?: string | null;
  actorKind?: "agent" | "human";
}

/** Pure: returns a NEW session with the record appended. Never mutates in place. */
export function appendAudit(session: SessionState, entry: AuditInput): SessionState {
  const seq = session.seq + 1;
  const actorKind = entry.actorKind ?? "agent";

  const record: AuditRecord = {
    seq,
    at: isoForMinute(session.nowMinute),
    atMinute: session.nowMinute,
    actor: { kind: actorKind, identity: actorKind === "human" ? "console-user" : "agent", sessionId: session.sessionId },
    tool: entry.tool,
    args: entry.args,
    approvalId: entry.approvalId ?? null,
    outcome: entry.outcome,
    denialReason: entry.denialReason ?? null,
    resultSummary: entry.resultSummary,
    stateBefore: entry.stateBefore ?? null,
    stateAfter: entry.stateAfter ?? null,
  };

  return { ...session, seq, events: [...session.events, record] };
}
