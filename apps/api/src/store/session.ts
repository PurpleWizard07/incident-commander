import type { AuditRecord, Approval, Incident, IncidentState, Role, ServiceId, MetricName } from "../sharedTypes.js";
import type { ScenarioId, RecoveryCurve, RemediationEffect, AppliedRemediation } from "../simEngine.js";
import { getScenario, isoForMinute } from "../simEngine.js";
import { readModifyWrite, readJSON } from "./blobs.js";

/**
 * Recorded once a gated action executes (routes/actions.ts). Never cleared
 * on settling into MONITORING — clearing it would snap the resolved clock
 * (see `resolveNowMinute` below) back to the frozen `nowMinute`, undoing the
 * recovery the agent just observed. Only a NEW gated action replaces it.
 */
export interface ExecutedRemediation {
  incidentId: string;
  tool: string;
  effect: RemediationEffect;
  recoveryServices: ServiceId[];
  recoveryMetric: MetricName;
  recoveryCurve: RecoveryCurve | null;
  executedAtMinute: number;
  executedAtRealMs: number;
}

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
  executedRemediation: ExecutedRemediation | null;
}

/**
 * How fast the virtual clock runs once a gated action has executed — plan
 * §2.2's "accelerated clock during recovery, 400ms [poll], matched to the
 * tick rate." There is no live-ticking clock outside this window (plan §7.1's
 * states before RECOVERING are all reachable synchronously within one
 * request/response, so nothing needs a clock tick to observe them); this is
 * deliberately the ONLY place virtual time advances on its own; see phase-
 * summary.md's Phase 6 decisions log for why a wall-clock-driven virtual
 * minute — rather than extending the scenario engine to know about actions
 * it never takes — is the proportionate design here.
 */
const ACCEL_MS_PER_VIRTUAL_MINUTE = 1000;
/** Extra virtual minutes held at the settled value before flipping the incident's state, so the recovered metric is visibly stable before "Recovery threshold met" (plan §7.1) fires. */
const POST_SETTLE_HOLD_MINUTES = 3;

function recoveryWindowMinutes(r: ExecutedRemediation): number {
  return (r.recoveryCurve?.toMinutes ?? 4) + POST_SETTLE_HOLD_MINUTES;
}

/** The clock stays frozen at `session.nowMinute` unless a remediation is in flight or has settled. */
function resolveNowMinute(session: SessionState): number {
  const r = session.executedRemediation;
  if (!r) return session.nowMinute;
  const elapsedMinutes = (Date.now() - r.executedAtRealMs) / ACCEL_MS_PER_VIRTUAL_MINUTE;
  const advanced = Math.min(recoveryWindowMinutes(r), elapsedMinutes);
  return r.executedAtMinute + Math.floor(advanced);
}

/** Console-side (never a tool): the raw series overlay reflecting an executed action, for `/api/metrics/series` and `/api/metrics/compare` to blend into their results. */
export function appliedRemediationFor(session: SessionState): AppliedRemediation | undefined {
  const r = session.executedRemediation;
  if (!r || !r.recoveryCurve || (r.effect !== "full_recovery" && r.effect !== "partial_recovery")) return undefined;
  return {
    services: r.recoveryServices,
    metric: r.recoveryMetric,
    appliedAtMinute: r.executedAtMinute,
    recoveryCurve: r.recoveryCurve,
  };
}

/**
 * Settles `RECOVERING` into `MONITORING` (recovery effects) or back into
 * `INVESTIGATING` (no_effect/worsens — plan §7.1's "pulls it back into
 * investigation on its own") once enough real time has elapsed to cover the
 * recovery window. Pure — callers persist the result if it changed.
 */
function reconcileIncidentState(session: SessionState): SessionState {
  const r = session.executedRemediation;
  if (!r) return session;
  const incident = session.incidents.find((i) => i.id === r.incidentId);
  if (!incident || incident.state !== "RECOVERING") return session;

  const elapsedMinutes = (Date.now() - r.executedAtRealMs) / ACCEL_MS_PER_VIRTUAL_MINUTE;
  if (elapsedMinutes < recoveryWindowMinutes(r)) return session;

  const settledMinute = r.executedAtMinute + recoveryWindowMinutes(r);
  const isRecovery = r.effect === "full_recovery" || r.effect === "partial_recovery";
  const newState: IncidentState = isRecovery ? "MONITORING" : "INVESTIGATING";
  const summary = isRecovery
    ? `Recovery confirmed: metrics have held near baseline. Ready to verify and resolve.`
    : `No improvement ${recoveryWindowMinutes(r)} minutes after ${r.tool} — reverting to investigation.`;

  const updated: Incident = {
    ...incident,
    state: newState,
    timeline: [...incident.timeline, { atMinute: settledMinute, at: isoForMinute(settledMinute), source: "system", summary }],
  };
  return { ...session, incidents: session.incidents.map((i) => (i.id === updated.id ? updated : i)) };
}

/** The clock is always recomputed transiently (never conditions whether we persist) — it's a pure function of fixed anchors, so it's correct whether or not `nowMinute` in storage is stale. */
function withResolvedClock(session: SessionState): SessionState {
  const resolvedMinute = resolveNowMinute(session);
  return resolvedMinute === session.nowMinute ? session : { ...session, nowMinute: resolvedMinute };
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
    executedRemediation: null,
  };
}

function bootstrapSession(sessionId: string): SessionState {
  return bootstrapSessionWith(sessionId, "INC-4821", 42);
}

function keyFor(sessionId: string): string {
  return `session:${sessionId}`;
}

/**
 * The clock is resolved transiently on every read regardless of persistence
 * (it's a pure function of fixed anchors — always correct even if what's in
 * storage is stale). Incident-state settlement (RECOVERING → MONITORING/
 * INVESTIGATING) is a real, discrete transition, so it IS persisted, but
 * only on the poll where it actually happens — not on every single read
 * during the recovery window, which would otherwise write to Blobs on
 * nearly every 400ms poll tick for several seconds. This is what makes a
 * GET-only poller (or an agent that only calls read-only tools to "verify")
 * still see the incident settle into MONITORING without ever triggering a
 * mutating call itself.
 */
export async function loadSession(sessionId: string): Promise<SessionState> {
  const existing = await readJSON<SessionState>(keyFor(sessionId));
  const session = existing ?? bootstrapSession(sessionId);
  const withState = reconcileIncidentState(session);
  if (withState === session) return withResolvedClock(session);

  const persisted = await readModifyWrite(keyFor(sessionId), () => bootstrapSession(sessionId), (current) => {
    const currentWithState = reconcileIncidentState(current);
    return { next: currentWithState, result: currentWithState };
  });
  return withResolvedClock(persisted);
}

/**
 * `mutate` returns both the new session AND an arbitrary `result` (typically
 * an HTTP response) — see store/blobs.ts's readModifyWrite for why a bare new
 * state isn't enough. `current` has state settlement and the resolved clock
 * applied before `mutate` sees it, so a mutation (e.g. `resolve_incident`'s
 * MONITORING check) always acts on up-to-date state, not a stale snapshot —
 * and if settlement changed anything, it's captured in the same write as
 * whatever `mutate` itself does, at no extra cost.
 */
export async function withSession<R>(
  sessionId: string,
  mutate: (state: SessionState) => { next: SessionState; result: R }
): Promise<R> {
  return readModifyWrite(keyFor(sessionId), () => bootstrapSession(sessionId), (current) =>
    mutate(withResolvedClock(reconcileIncidentState(current)))
  );
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
