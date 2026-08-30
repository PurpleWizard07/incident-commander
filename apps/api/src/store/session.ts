import type { AuditRecord, Approval, Incident, IncidentState, Role } from "../sharedTypes.js";
import type { ScenarioId } from "../simEngine.js";
import { getScenario, isoForMinute } from "../simEngine.js";
import { readModifyWrite, readJSON } from "./blobs.js";

export interface SessionState {
  sessionId: string;
  scenarioId: ScenarioId;
  seed: number;
  nowMinute: number;
  role: Role;
  seq: number;
  events: AuditRecord[];
  incidents: Incident[];
  approvals: Approval[];
}

/**
 * Incidents and approvals are cached views kept in lockstep with `events` on
 * every write (see store/blobs.ts) rather than recomputed by replaying the log
 * on each read. This is a deliberate simplification of plan §2.1's literal
 * "current world = pure reduction over the event log": for a single session
 * with one active agent, keeping cached views in the same read-modify-write
 * transaction as the event that produced them gives the identical guarantee
 * (nothing can exist without a corresponding audit entry; a restart loses
 * nothing) with far less code than a general event-sourcing reducer. Recorded
 * in phase-summary.md's Phase 2 decisions log.
 */
function bootstrapIncidents(scenarioId: ScenarioId): Incident[] {
  const scenario = getScenario(scenarioId);
  const openedAt = isoForMinute(scenario.openedAtMinute);
  const state: IncidentState = "INVESTIGATING";
  return [
    {
      id: scenario.id,
      title: scenario.title,
      severity: scenario.severity,
      state,
      openedAtMinute: scenario.openedAtMinute,
      openedAt,
      resolvedAt: null,
      affectedServices: scenario.affectedServices,
      assignee: null,
      notes: [],
      timeline: [{ atMinute: scenario.openedAtMinute, at: openedAt, source: "system", summary: `${scenario.id} opened: ${scenario.title}` }],
    },
  ];
}

function bootstrapSessionWith(sessionId: string, scenarioId: ScenarioId, seed: number): SessionState {
  const scenario = getScenario(scenarioId);
  return {
    sessionId,
    scenarioId,
    seed,
    nowMinute: scenario.defaultNowMinute,
    role: "responder",
    seq: 0,
    events: [],
    incidents: bootstrapIncidents(scenarioId),
    approvals: [],
  };
}

function bootstrapSession(sessionId: string): SessionState {
  return bootstrapSessionWith(sessionId, "INC-4821", 42);
}

function keyFor(sessionId: string): string {
  return `session:${sessionId}`;
}

export async function loadSession(sessionId: string): Promise<SessionState> {
  const existing = await readJSON<SessionState>(keyFor(sessionId));
  return existing ?? bootstrapSession(sessionId);
}

/**
 * `mutate` returns both the new session AND an arbitrary `result` (typically
 * an HTTP response) — see store/blobs.ts's readModifyWrite for why a bare new
 * state isn't enough.
 */
export async function withSession<R>(
  sessionId: string,
  mutate: (state: SessionState) => { next: SessionState; result: R }
): Promise<R> {
  return readModifyWrite(keyFor(sessionId), () => bootstrapSession(sessionId), mutate);
}

/** Resets to a fresh bootstrap, optionally loading a different scenario/seed (`POST /api/sim/*`, console-only, never a tool — plan §11). */
export async function resetSessionTo(sessionId: string, scenarioId: ScenarioId, seed: number): Promise<SessionState> {
  const fresh = bootstrapSessionWith(sessionId, scenarioId, seed);
  await readModifyWrite(
    keyFor(sessionId),
    () => fresh,
    () => ({ next: fresh, result: fresh })
  );
  return fresh;
}
