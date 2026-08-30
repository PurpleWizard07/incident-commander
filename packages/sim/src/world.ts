import type { ServiceId, MetricName, MetricSeries } from "@incident-commander/shared";
import { SERVICE_IDS } from "@incident-commander/shared";
import { Rng, deriveSeed } from "./prng.js";
import type { Scenario, World } from "./types.js";
import { buildMetricSeries } from "./generators/metrics.js";
import { generateTraces, indexTraceIdsByServiceMinute } from "./generators/traces.js";
import { generateLogs } from "./generators/logs.js";

const ALL_METRIC_NAMES: MetricName[] = [
  "request_rate",
  "error_rate",
  "latency_p50",
  "latency_p95",
  "latency_p99",
  "cpu",
  "memory",
  "queue_depth",
  "db_pool_utilization",
  "db_pool_wait_ms",
  "gc_pause_ms",
  "external_call_error_rate",
  "external_call_latency",
];

const METRIC_UNITS: Record<MetricName, string> = {
  request_rate: "req/min",
  error_rate: "fraction",
  latency_p50: "ms",
  latency_p95: "ms",
  latency_p99: "ms",
  cpu: "fraction",
  memory: "fraction",
  queue_depth: "messages",
  db_pool_utilization: "fraction",
  db_pool_wait_ms: "ms",
  gc_pause_ms: "ms",
  external_call_error_rate: "fraction",
  external_call_latency: "ms",
};

/**
 * A (service, metric) pair's baseline is the `from` value of the first phase
 * that touches it — scenario authors declare the visible shape once, not a
 * separately duplicated baseline number.
 */
function inferBaseline(scenario: Scenario, service: ServiceId, metric: MetricName): number {
  const first = scenario.phases
    .filter((p) => p.service === service && p.metric === metric)
    .sort((a, b) => a.fromMinute - b.fromMinute)[0];
  return first ? first.from : 0;
}

export function materializeWorld(scenario: Scenario, seed: number, nowMinute: number): World {
  const fromMinute = 0;

  // Each series/generator gets its OWN independently-seeded rng stream, keyed by
  // what it generates rather than shared and threaded in iteration order. This is
  // what makes materializeWorld's output at minute 50 a stable PREFIX of its
  // output at minute 93 — a past data point never changes value on a later poll,
  // which matters for real live polling (plan §2.2), not just for this test.
  // A single shared rng consumed sequentially across every series would instead
  // make every later series' values depend on how many draws earlier series
  // happened to consume, which itself depends on nowMinute — silently breaking
  // both prefix-stability and the intuition that changing what you ask for
  // shouldn't reshuffle values you already saw.
  const metrics: MetricSeries[] = [];
  for (const service of SERVICE_IDS) {
    for (const metric of ALL_METRIC_NAMES) {
      const baseline = inferBaseline(scenario, service, metric);
      const seriesRng = new Rng(deriveSeed(`${scenario.id}:metric:${service}:${metric}`, seed));
      const series = buildMetricSeries(
        scenario.phases,
        service,
        metric,
        METRIC_UNITS[metric],
        baseline,
        fromMinute,
        nowMinute,
        seriesRng
      );
      if (series) metrics.push(series);
    }
  }

  const tracesSeed = deriveSeed(`${scenario.id}:traces`, seed);
  const traces = generateTraces(scenario.traceShapes, fromMinute, nowMinute, tracesSeed);
  const traceIndex = indexTraceIdsByServiceMinute(traces);

  const logsSeed = deriveSeed(`${scenario.id}:logs`, seed);
  const logs = generateLogs(scenario.logTemplates, scenario.deployments, fromMinute, nowMinute, logsSeed, traceIndex);

  const alerts = scenario.alerts.filter((a) => a.firedAtMinute <= nowMinute);
  const changes = scenario.changes.filter((c) => c.atMinute <= nowMinute);
  const deployments = scenario.deployments.filter((d) => d.deployedAtMinute <= nowMinute);

  const services = {} as World["services"];
  for (const service of SERVICE_IDS) {
    const errSeries = metrics.find((m) => m.service === service && m.metric === "error_rate");
    const baseline = errSeries?.baseline ?? 0;
    const latest = errSeries?.points[errSeries.points.length - 1];
    const errorRate = latest?.value ?? baseline;
    // Phase 1's hero incident never takes a service fully offline, so a binary
    // healthy/degraded threshold is sufficient; "down" is a real status value
    // a future scenario can produce, not a case this threshold needs to reach yet.
    const status = errorRate > baseline * 5 + 0.02 ? "degraded" : "healthy";
    services[service] = { status, errorRate };
  }

  return { scenarioId: scenario.id, seed, nowMinute, services, metrics, logs, traces, deployments, changes, alerts };
}

/**
 * First minute at which `series` sustains a deviation of at least `multiplier`x
 * baseline for `sustainMinutes` consecutive points. Mirrors what compare_metrics
 * will expose in Phase 3 — this is the correlation contract from plan §14.3.
 */
export function findOnsetMinute(series: MetricSeries, opts?: { multiplier?: number; sustainMinutes?: number }): number | null {
  const multiplier = opts?.multiplier ?? 3;
  const sustain = opts?.sustainMinutes ?? 2;
  const threshold = series.baseline * multiplier + 1e-9;

  let run = 0;
  for (let i = 0; i < series.points.length; i++) {
    if (series.points[i].value > threshold) {
      run++;
      if (run >= sustain) return series.points[i - sustain + 1].minute;
    } else {
      run = 0;
    }
  }
  return null;
}
