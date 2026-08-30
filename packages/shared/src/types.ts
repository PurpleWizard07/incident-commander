export type ServiceId =
  | "frontend"
  | "checkout"
  | "payments"
  | "auth"
  | "database"
  | "queue"
  | "notifications";

export const SERVICE_IDS: ServiceId[] = [
  "frontend",
  "checkout",
  "payments",
  "auth",
  "database",
  "queue",
  "notifications",
];

export type ServiceStatus = "healthy" | "degraded" | "down";

export interface ServiceHealth {
  service: ServiceId;
  status: ServiceStatus;
  errorRate: number;
  latencyP95Ms: number;
  baseline: {
    errorRate: number;
    latencyP95Ms: number;
  };
}

// --- Static topology (plan §3.1) ---------------------------------------

export interface Service {
  id: ServiceId;
  displayName: string;
  tier: 1 | 2 | 3;
  dependsOn: ServiceId[];
  externalDependencies: string[];
  instances: number;
  owner: string;
}

export const SERVICES: Record<ServiceId, Service> = {
  frontend: {
    id: "frontend",
    displayName: "Frontend",
    tier: 1,
    dependsOn: ["checkout", "auth"],
    externalDependencies: [],
    instances: 8,
    owner: "Web Platform",
  },
  checkout: {
    id: "checkout",
    displayName: "Checkout",
    tier: 1,
    dependsOn: ["payments", "database", "queue"],
    externalDependencies: [],
    instances: 6,
    owner: "Checkout",
  },
  payments: {
    id: "payments",
    displayName: "Payments",
    tier: 1,
    dependsOn: ["database"],
    externalDependencies: ["northwind-pay"],
    instances: 5,
    owner: "Payments",
  },
  auth: {
    id: "auth",
    displayName: "Auth",
    tier: 2,
    dependsOn: ["database"],
    externalDependencies: [],
    instances: 4,
    owner: "Identity",
  },
  database: {
    id: "database",
    displayName: "Database",
    tier: 3,
    dependsOn: [],
    externalDependencies: [],
    instances: 3,
    owner: "Data Infra",
  },
  queue: {
    id: "queue",
    displayName: "Queue",
    tier: 3,
    dependsOn: ["database"],
    externalDependencies: [],
    instances: 3,
    owner: "Data Infra",
  },
  notifications: {
    id: "notifications",
    displayName: "Notifications",
    tier: 2,
    dependsOn: ["queue"],
    externalDependencies: [],
    instances: 3,
    owner: "Growth",
  },
};

// --- Metrics (plan §3.3) -------------------------------------------------

export type MetricName =
  | "request_rate"
  | "error_rate"
  | "latency_p50"
  | "latency_p95"
  | "latency_p99"
  | "cpu"
  | "memory"
  | "queue_depth"
  | "db_pool_utilization"
  | "db_pool_wait_ms"
  | "gc_pause_ms"
  | "external_call_error_rate"
  | "external_call_latency";

export interface MetricPoint {
  t: string;
  minute: number;
  value: number;
}

export interface MetricSeries {
  service: ServiceId;
  metric: MetricName;
  unit: string;
  points: MetricPoint[];
  baseline: number;
}

// --- Logs (plan §3.4) -----------------------------------------------------

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR" | "FATAL";

export interface LogEntry {
  timestamp: string;
  minute: number;
  service: ServiceId;
  level: LogLevel;
  deployment: string | null;
  message: string;
  traceId: string | null;
  attributes: Record<string, string | number | boolean>;
}

// --- Traces (plan §3.5) ----------------------------------------------------

export interface Span {
  spanId: string;
  parentSpanId: string | null;
  service: ServiceId;
  name: string;
  startOffsetMs: number;
  durationMs: number;
  status: "ok" | "error";
  errorMessage: string | null;
  attributes: Record<string, string | number | boolean>;
}

export interface Trace {
  traceId: string;
  startedAt: string;
  minute: number;
  durationMs: number;
  status: "ok" | "error";
  rootService: ServiceId;
  spans: Span[];
  failingSpanId: string | null;
}

// --- Deployments (plan §3.2) -----------------------------------------------

export type DeploymentStatus = "active" | "superseded" | "rolled_back";
export type RiskScore = "low" | "medium" | "high";

export interface Deployment {
  id: string;
  service: ServiceId;
  version: string;
  deployedAtMinute: number;
  deployedAt: string;
  deployedBy: string;
  commitSha: string;
  commitMessage: string;
  status: DeploymentStatus;
  rollbackTargetId: string | null;
  changedFiles: number;
  riskScore: RiskScore;
}

// --- Non-deploy changes (plan §3.6) -----------------------------------------

export type ChangeType = "feature_flag" | "config" | "scaling" | "scheduled_job" | "infrastructure";

export interface Change {
  id: string;
  type: ChangeType;
  service: ServiceId | null;
  atMinute: number;
  at: string;
  actor: string;
  summary: string;
  before: string;
  after: string;
}

// --- Alerts (plan §3.7) -----------------------------------------------------

export type Severity = "SEV-1" | "SEV-2" | "SEV-3";

export interface Alert {
  id: string;
  name: string;
  service: ServiceId;
  metric: MetricName;
  threshold: number;
  comparator: ">" | "<";
  firedAtMinute: number;
  firedAt: string;
  resolvedAt: string | null;
  severity: Severity;
  incidentId: string | null;
  currentValue: number;
}
