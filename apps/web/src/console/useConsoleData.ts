import { useEffect, useRef, useState } from "react";
import type { ServiceId, Incident } from "@incident-commander/shared";
import { SERVICE_IDS } from "@incident-commander/shared";
import {
  getState,
  getServiceHealth,
  getRecentDeployments,
  getRecentChanges,
  queryLogs,
  searchTraces,
  getMetricSeries,
  type ServiceHealthSummary,
  type RawMetricSeries,
} from "./api.js";
import type { Deployment, Change, LogEntry, Trace } from "@incident-commander/shared";

/**
 * Poll cadence from plan §2.2. Only "idle" and "incidentOpen" are reachable in
 * Phase 4 — "activity" (tool call in flight) and "accelerated" (recovery
 * animation) are Phase 5/6 concerns, wired here as a forward-compatible
 * override so the polling loop itself doesn't need to change shape later.
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
export function useConsoleData(pollTierOverride?: PollTier): ConsoleData {
  const [data, setData] = useState<ConsoleData>(EMPTY);
  const seqRef = useRef(0);
  const nowMinuteRef = useRef<number | null>(null);
  const hasIncidentRef = useRef(false);

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

        setData((prev) => ({
          ...prev,
          loading: false,
          error: null,
          incident,
          role: state.role,
          scenarioId: state.scenarioId,
        }));

        if (incident && nowMinuteRef.current !== state.nowMinute) {
          await loadEvidence(state.nowMinute, incident.affectedServices);
        }
      } catch (err) {
        if (cancelled) return;
        setData((prev) => ({ ...prev, loading: false, error: err instanceof Error ? err.message : String(err) }));
      } finally {
        if (!cancelled) {
          const tier: PollTier = pollTierOverride ?? (hasIncidentRef.current ? "incidentOpen" : "idle");
          timer = setTimeout(tick, POLL_INTERVAL_MS[tier]);
        }
      }
    }

    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollTierOverride]);

  return data;
}
