import type { SessionState } from "../store/session.js";

export function getAudit(session: SessionState) {
  return { status: 200, body: { events: session.events } };
}
