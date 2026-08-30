import type { SessionState } from "../store/session.js";

export function getState(session: SessionState, since: string | null) {
  const sinceSeq = since ? Number(since) : 0;
  return {
    status: 200,
    body: {
      seq: session.seq,
      nowMinute: session.nowMinute,
      role: session.role,
      scenarioId: session.scenarioId,
      incidents: session.incidents,
      pendingApprovals: session.approvals.filter((a) => a.status === "pending"),
      newEvents: session.events.filter((e) => e.seq > sinceSeq),
    },
  };
}
