import type { ServiceId, MetricName } from "../sharedTypes.js";
import { SERVICE_IDS } from "../sharedTypes.js";
import { materializeWorld, getScenario, findOnsetMinute } from "../simEngine.js";
import { appliedRemediationFor, type SessionState } from "../store/session.js";

function isServiceId(v: string): v is ServiceId {
  return (SERVICE_IDS as string[]).includes(v);
}

export function queryLogs(
  session: SessionState,
  opts: { service: string | null; level: string | null; contains: string | null; fromMinute: string | null; toMinute: string | null; limit: string | null }
) {
  if (opts.service && !isServiceId(opts.service)) {
    return { status: 400, body: { error: `Unknown service "${opts.service}".` } };
  }
  const world = materializeWorld(getScenario(session.scenarioId), session.seed, session.nowMinute, appliedRemediationFor(session));
  const limit = Math.min(200, opts.limit ? Number(opts.limit) : 50);
  const fromMinute = opts.fromMinute ? Number(opts.fromMinute) : 0;
  const toMinute = opts.toMinute ? Number(opts.toMinute) : session.nowMinute;
  const containsLower = opts.contains?.toLowerCase();

  const matched = world.logs.filter((l) => {
    if (opts.service && l.service !== opts.service) return false;
    if (opts.level && l.level !== opts.level) return false;
    if (l.minute < fromMinute || l.minute > toMinute) return false;
    if (containsLower && !l.message.toLowerCase().includes(containsLower)) return false;
    return true;
  });

  const patterns = new Map<string, number>();
  for (const entry of matched) patterns.set(entry.message, (patterns.get(entry.message) ?? 0) + 1);

  return {
    status: 200,
    body: {
      totalMatched: matched.length,
      patterns: [...patterns.entries()].map(([message, count]) => ({ message, count })),
      entries: matched.slice(0, limit),
      truncated: matched.length > limit,
      note:
        matched.length === 0
          ? "No log lines match this query. Try widening the time window or removing filters."
          : matched.length > limit
            ? `${matched.length - limit} further matching lines omitted; narrow with contains or level.`
            : undefined,
    },
  };
}

export function searchTraces(session: SessionState, opts: { service: string | null; status: string | null; limit: string | null }) {
  if (opts.service && !isServiceId(opts.service)) {
    return { status: 400, body: { error: `Unknown service "${opts.service}".` } };
  }
  const world = materializeWorld(getScenario(session.scenarioId), session.seed, session.nowMinute, appliedRemediationFor(session));
  const status = opts.status ?? "error";
  const limit = Math.min(50, opts.limit ? Number(opts.limit) : 20);

  const matched = world.traces.filter((t) => {
    if (status !== "any" && t.status !== status) return false;
    if (opts.service && !t.spans.some((s) => s.service === opts.service)) return false;
    return true;
  });

  const byFailingSpan = new Map<string, number>();
  for (const t of matched) {
    if (!t.failingSpanId) continue;
    const span = t.spans.find((s) => s.spanId === t.failingSpanId);
    const name = span?.name ?? "unknown";
    byFailingSpan.set(name, (byFailingSpan.get(name) ?? 0) + 1);
  }

  return {
    status: 200,
    body: {
      totalMatched: matched.length,
      failingSpanBreakdown: [...byFailingSpan.entries()].map(([name, count]) => ({
        spanName: name,
        count,
        proportion: matched.length ? Math.round((count / matched.length) * 1000) / 1000 : 0,
      })),
      sample: matched.slice(0, limit),
      note: matched.length === 0 ? `No ${status === "any" ? "" : status + " "}traces found for this query.` : undefined,
    },
  };
}

/**
 * Console-only (never a WebMCP tool — plan §11's separation of `/api/sim/*`
 * and `/api/audit` applies here too): returns raw MetricSeries with full point
 * arrays, for the metrics chart to render. `compare_metrics` deliberately
 * strips points down to baseline/current/onset for the agent's 1.5K budget —
 * "the chart is for the human; the summary is for the agent" (plan §11 line
 * ~1130). No endpoint existed for the human's actual chart data; this is it.
 */
export function getMetricSeries(
  session: SessionState,
  opts: { services: string[] | null; metrics: string[] | null; fromMinute: string | null; toMinute: string | null }
) {
  const scenario = getScenario(session.scenarioId);
  const world = materializeWorld(scenario, session.seed, session.nowMinute, appliedRemediationFor(session));

  const defaultServices = session.incidents[0]?.affectedServices ?? SERVICE_IDS;
  const requestedServices = (opts.services?.filter(isServiceId) as ServiceId[] | undefined) ?? defaultServices;
  const requestedMetrics = (opts.metrics as MetricName[] | undefined) ?? (["error_rate", "latency_p99"] as MetricName[]);
  const fromMinute = opts.fromMinute ? Number(opts.fromMinute) : Math.max(0, session.nowMinute - 90);
  const toMinute = opts.toMinute ? Number(opts.toMinute) : session.nowMinute;

  const series = requestedServices.flatMap((service) =>
    requestedMetrics.flatMap((metric) => {
      const found = world.metrics.find((m) => m.service === service && m.metric === metric);
      if (!found) return [];
      return [
        {
          service,
          metric,
          unit: found.unit,
          baseline: found.baseline,
          points: found.points.filter((p) => p.minute >= fromMinute && p.minute <= toMinute),
        },
      ];
    })
  );

  return { status: 200, body: { series } };
}

export function compareMetrics(
  session: SessionState,
  opts: { services: string[] | null; metrics: string[] | null; fromMinute: string | null; toMinute: string | null }
) {
  const scenario = getScenario(session.scenarioId);
  const world = materializeWorld(scenario, session.seed, session.nowMinute, appliedRemediationFor(session));

  // Plan §6.3: "Omit for all affected services" — the incident's affected
  // services, not literally every service in the system. Falls back to
  // SERVICE_IDS only if there's no incident on record to scope to (shouldn't
  // happen in practice, since a session always bootstraps one).
  const defaultServices = session.incidents[0]?.affectedServices ?? SERVICE_IDS;
  const requestedServices = (opts.services?.filter(isServiceId) as ServiceId[] | undefined) ?? defaultServices;
  const requestedMetrics = (opts.metrics as MetricName[] | undefined) ?? (["error_rate", "latency_p99"] as MetricName[]);
  const fromMinute = opts.fromMinute ? Number(opts.fromMinute) : Math.max(0, session.nowMinute - 90);
  const toMinute = opts.toMinute ? Number(opts.toMinute) : session.nowMinute;

  const results = requestedServices.flatMap((service) =>
    requestedMetrics.map((metric) => {
      const series = world.metrics.find((m) => m.service === service && m.metric === metric);
      if (!series) return { service, metric, present: false as const };
      const windowed = { ...series, points: series.points.filter((p) => p.minute >= fromMinute && p.minute <= toMinute) };
      const onsetMinute = findOnsetMinute(windowed);
      const last = series.points[series.points.length - 1]?.value ?? series.baseline;
      return {
        service,
        metric,
        present: true as const,
        baseline: series.baseline,
        current: last,
        onsetMinute,
        deviatesFromBaseline: onsetMinute !== null,
      };
    })
  );

  const orderedByOnset = results
    .filter((r) => r.present && r.onsetMinute !== null)
    .sort((a, b) => (a as { onsetMinute: number }).onsetMinute - (b as { onsetMinute: number }).onsetMinute)
    .map((r) => ({ service: r.service, metric: r.metric, onsetMinute: (r as { onsetMinute: number }).onsetMinute }));

  const absent = results.filter((r) => !r.present).map((r) => `${r.service}.${r.metric}`);

  return {
    status: 200,
    body: {
      results,
      orderedByOnset,
      note:
        absent.length > 0
          ? `No data for: ${absent.join(", ")} — this metric does not apply to that service (e.g. db_pool_utilization only exists on database), not a zero value.`
          : undefined,
    },
  };
}
