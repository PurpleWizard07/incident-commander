import type { Role } from "../sharedTypes.js";
import type { SessionState } from "../store/session.js";

const VALID_ROLES: Role[] = ["responder", "approver", "observer"];

export function setRole(session: SessionState, role: string | undefined): { session: SessionState; response: { status: number; body: unknown } } {
  if (!role || !VALID_ROLES.includes(role as Role)) {
    return { session, response: { status: 400, body: { error: `role must be one of ${VALID_ROLES.join(", ")}.` } } };
  }
  return { session: { ...session, role: role as Role }, response: { status: 200, body: { role } } };
}
