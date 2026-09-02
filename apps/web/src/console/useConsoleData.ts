import { useEffect, useRef, useState } from "react";
import type { ServiceId, Incident, Approval } from "@incident-commander/shared";
import { SERVICE_IDS } from "@incident-commander/shared";
import {
  getState,
  getServiceHealth,
  getRecentDeployments,
  getRecentChanges,
  queryLogs,
  searchTraces,
  getMetricSeries,
  loadScenario,
  type ServiceHealthSummary,
  type RawMetricSeries,
} from "./api.js";
import type { Deployment, Change, LogEntry, Trace } from "@incident-commander/shared";

/**
 * Poll cadence from plan §2.2, all four tiers live:
 *
 *   idle 5s · incidentOpen 2s · activity 750ms · accelerated 400ms
 *
 * "accelerated" fires automatically while the incident is `RECOVERING`
 * (Phase 6's executed-remediation window) — the real recovery happens
 * server-side over a handful of real seconds (see store/session.ts), and fast
 * polling is what makes the metrics chart visibly animate as it happens.
 *
 * "activity" (a tool call in flight) has to come from the caller: this hook
 * sits BELOW `ToolActivityProvider` in the tree, so it cannot read tool-call
 * state itself. `AppShell` already subscribes to those records and passes the
 * tier down.
 *
 * The override is read through a ref, not a dependency. Putting it in the
 * effect's dep array would tear down and rebuild the whole polling loop on
 * every start/settle transition — and, worse, re-run the `?scenario=` bootstrap
 * at the bottom of the effect, which calls `switchScenario` and would reset the
 * simulated world out from under the agent on its own first tool call.
 */
export type PollTier = "idle" | "incidentOpen" | "activity" | "accelerated";
const POLL_INTERVAL_MS: Record<PollTier, number> = {
  idle: 5000,
  incidentOpen: 2000,
  activity: 750,
  accelerated: 400,
};

export interface ConsoleData {
  loading: boolean;
  error: string | null;
  incident: Incident | null;
  nowMinute: number;
  role: string;
  scenarioId: string;
  serviceHealth: Partial<Record<ServiceId, ServiceHealthSummary>>;
  deployments: Deployment[];
  changes: Change[];
  logs: LogEntry[];
  logsNote?: string;
  traces: Trace[];
  tracesNote?: string;
  metricSeries: RawMetricSeries[];
  pendingApprovals: Approval[];
}

const EMPTY: ConsoleData = {
  loading: true,
  error: null,
  incident: null,
  nowMinute: 0,
  role: "responder",
  scenarioId: "",
  serviceHealth: {},
  deployments: [],
  changes: [],
  logs: [],
  traces: [],
  metricSeries: [],
  pendingApprovals: [],
};

/**
 * Loads the console's incident + evidence data and keeps it fresh via
 * adaptive polling of GET /api/state?since=<seq> (plan §2.2). Evidence
 * (metrics/logs/traces/deployments/changes/service health) is a pure function
 * of `(scenario, seed, nowMinute)` — it is only re-fetched when `nowMinute`
 * actually changes, not on every poll tick. The incident record itself
 * (state, notes, timeline, assignee) comes back inline on every /api/state
 * response, so it updates in place with no extra request.
 */
export interface ConsoleDataHandle {
  data: ConsoleData;
  /** Forces an immediate poll instead of waiting for the current tier's interval — used right after an action the human just took (e.g. a role switch) that they'd otherwise wait up to 2s to see reflected. */
  refresh: () => void;
  /** Plan §8 scenario picker: loads a different scenario/seed into this session, then refreshes immediately. */
  switchScenario: (scenarioId: string, seed?: string) => Promise<void>;
}

export function useConsoleData(pollTierOverride?: PollTier): ConsoleDataHandle {
  const [data, setData] = useState<ConsoleData>(EMPTY);
  const seqRef = useRef(0);
  // Deliberately a ref, not a dep — see this hook's doc comment.
  const overrideRef = useRef(pollTierOverride);
  overrideRef.current = pollTierOverride;
  const nowMinuteRef = useRef<number | null>(null);
  const hasIncidentRef = useRef(false);
  const incidentStateRef = useRef<string | null>(null);
  const refreshRef = useRef<() => void>(() => {});
  const switchScenarioRef = useRef<(scenarioId: string, seed?: string) => Promise<void>>(async () => {});

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function loadEvidence(nowMinute: number, affectedServices: ServiceId[]) {
      const [healthList, deploymentsRes, changesRes, logsRes, tracesRes, metricsRes] = await Promise.all([
        Promise.all(SERVICE_IDS.map((s) => getServiceHealth(s).catch(() => null))),
        getRecentDeployments(undefined, 4320),
        getRecentChanges(undefined, 4320),
        queryLogs({ limit: 200 }),
        searchTraces({ status: "any", limit: 20 }),
        getMetricSeries({ services: affectedServices, metrics: ["error_rate", "latency_p99"] }),
      ]);
      if (cancelled) return;

      const serviceHealth: Partial<Record<ServiceId, ServiceHealthSummary>> = {};
      for (const h of healthList) if (h) serviceHealth[h.service] = h;

      setData((prev) => ({
        ...prev,
        nowMinute,
        serviceHealth,
        deployments: deploymentsRes.deployments,
        changes: changesRes.changes,
        logs: logsRes.entries,
        logsNote: logsRes.note,
        traces: tracesRes.sample,
        tracesNote: tracesRes.note,
        metricSeries: metricsRes.series,
      }));
      nowMinuteRef.current = nowMinute;
    }

    async function tick() {
      try {
        const state = await getState(seqRef.current);
        if (cancelled) return;
        seqRef.current = state.seq;
        const incident = state.incidents[0] ?? null;
        hasIncidentRef.current = incident !== null;
        incidentStateRef.current = incident?.state ?? null;

        setData((prev) => ({
          ...prev,
          loading: false,
          error: null,
          incident,
          role: state.role,
          scenarioId: state.scenarioId,
          pendingApprovals: state.pendingApprovals,
        }));

        if (incident && nowMinuteRef.current !== state.nowMinute) {
          await loadEvidence(state.nowMinute, incident.affectedServices);
        }
      } catch (err) {
        if (cancelled) return;
        setData((prev) => ({ ...prev, loading: false, error: err instanceof Error ? err.message : String(err) }));
      } finally {
        if (!cancelled) {
          const tier: PollTier =
            incidentStateRef.current === "RECOVERING"
              ? "accelerated"
              : (overrideRef.current ?? (hasIncidentRef.current ? "incidentOpen" : "idle"));
          timer = setTimeout(tick, POLL_INTERVAL_MS[tier]);
        }
      }
    }

    refreshRef.current = () => {
      if (timer) clearTimeout(timer);
      tick();
    };

    switchScenarioRef.current = async (scenarioId, seed) => {
      if (timer) clearTimeout(timer);
      await loadScenario(scenarioId, seed);
      // A fresh session: every "have we already seen this" ref must forget the old one.
      seqRef.current = 0;
      nowMinuteRef.current = null;
      hasIncidentRef.current = false;
      incidentStateRef.current = null;
      setData(EMPTY);
      await tick();
    };

    // Plan §8: `?scenario=`/`?seed=` load a specific scenario before the first poll,
    // instead of whatever this session's session was last left on.
    const params = new URLSearchParams(window.location.search);
    const scenarioParam = params.get("scenario");
    const seedParam = params.get("seed") ?? undefined;
    if (scenarioParam) {
      switchScenarioRef.current(scenarioParam, seedParam);
    } else {
      tick();
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    data,
    refresh: () => refreshRef.current(),
    switchScenario: (scenarioId, seed) => switchScenarioRef.current(scenarioId, seed),
  };
}
