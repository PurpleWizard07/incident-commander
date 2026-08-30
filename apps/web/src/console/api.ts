import { apiGet } from "../webmcp/apiClient.js";
import type {
  ServiceId,
  ServiceStatus,
  MetricName,
  Deployment,
  Change,
  LogEntry,
  Trace,
  Incident,
  TimelineEvent,
} from "@incident-commander/shared";

export interface ActiveIncidentSummary {
  id: string;
  title: string;
  severity: string;
  state: string;
  affectedServices: ServiceId[];
  ageMinutes: number;
}

export interface IncidentDetail extends Incident {
  notesTruncated: boolean;
  timelineTruncated: boolean;
  pendingApprovalId: string | null;
}

export interface ServiceHealthSummary {
  service: ServiceId;
  status: ServiceStatus;
  errorRate: number;
  latencyP95Ms: number | null;
  baseline: { errorRate: number; latencyP95Ms: number | null };
  instances: number;
}

export interface RawMetricSeries {
  service: ServiceId;
  metric: MetricName;
  unit: string;
  baseline: number;
  points: { t: string; minute: number; value: number }[];
}

export function getActiveIncidents(): Promise<{ incidents: ActiveIncidentSummary[] }> {
  return apiGet("/api/incidents");
}

export function getIncident(id: string): Promise<IncidentDetail> {
  return apiGet(`/api/incidents/${encodeURIComponent(id)}`);
}

export function getIncidentTimeline(id: string, sinceMinute?: number): Promise<{ timeline: TimelineEvent[] }> {
  return apiGet(`/api/incidents/${encodeURIComponent(id)}/timeline`, {
    sinceMinute: sinceMinute?.toString(),
  });
}

export function getServiceHealth(service: ServiceId): Promise<ServiceHealthSummary> {
  return apiGet(`/api/services/${service}/health`);
}

export function getRecentDeployments(
  service?: ServiceId,
  withinMinutes?: number
): Promise<{ deployments: Deployment[]; note?: string }> {
  return apiGet("/api/deployments", { service, withinMinutes: withinMinutes?.toString() });
}

export function getRecentChanges(
  service?: ServiceId,
  withinMinutes?: number
): Promise<{ changes: Change[] }> {
  return apiGet("/api/changes", { service, withinMinutes: withinMinutes?.toString() });
}

export function queryLogs(opts: {
  service?: ServiceId;
  level?: string;
  fromMinute?: number;
  toMinute?: number;
  limit?: number;
}): Promise<{ totalMatched: number; entries: LogEntry[]; truncated: boolean; note?: string }> {
  return apiGet("/api/logs", {
    service: opts.service,
    level: opts.level,
    fromMinute: opts.fromMinute?.toString(),
    toMinute: opts.toMinute?.toString(),
    limit: opts.limit?.toString(),
  });
}

export function searchTraces(opts: {
  service?: ServiceId;
  status?: string;
  limit?: number;
}): Promise<{ totalMatched: number; sample: Trace[]; note?: string }> {
  return apiGet("/api/traces", {
    service: opts.service,
    status: opts.status,
    limit: opts.limit?.toString(),
  });
}

/** Console-only endpoint (never a WebMCP tool) — raw series with full points, for the chart. */
export function getMetricSeries(opts: {
  services?: ServiceId[];
  metrics?: MetricName[];
  fromMinute?: number;
  toMinute?: number;
}): Promise<{ series: RawMetricSeries[] }> {
  return apiGet("/api/metrics/series", {
    services: opts.services?.join(","),
    metrics: opts.metrics?.join(","),
    fromMinute: opts.fromMinute?.toString(),
    toMinute: opts.toMinute?.toString(),
  });
}

export interface MetricCompareResult {
  service: ServiceId;
  metric: MetricName;
  present: boolean;
  baseline?: number;
  current?: number;
  onsetMinute?: number | null;
}

export interface CompareMetricsResponse {
  results: MetricCompareResult[];
  orderedByOnset: { service: ServiceId; metric: MetricName; onsetMinute: number }[];
  note?: string;
}

/**
 * Same endpoint `compare_metrics` (the WebMCP tool) calls — the console
 * reuses it to draw onset markers when reacting to that tool's calls
 * (plan §9: "compared series are drawn together with onset markers"),
 * rather than re-deriving onset logic client-side.
 */
export function compareMetrics(opts: {
  services?: string[];
  metrics?: string[];
  fromMinute?: number;
  toMinute?: number;
}): Promise<CompareMetricsResponse> {
  return apiGet("/api/metrics/compare", {
    services: opts.services?.join(","),
    metrics: opts.metrics?.join(","),
    fromMinute: opts.fromMinute?.toString(),
    toMinute: opts.toMinute?.toString(),
  });
}

export interface StatePollResult {
  seq: number;
  nowMinute: number;
  role: string;
  scenarioId: string;
  /** Full `Incident` records, not the truncated shape `GET /api/incidents/:id` returns. */
  incidents: Incident[];
  pendingApprovals: unknown[];
  newEvents: { seq: number }[];
}

export function getState(sinceSeq: number): Promise<StatePollResult> {
  return apiGet("/api/state", { since: sinceSeq.toString() });
}
