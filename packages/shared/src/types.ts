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

// --- Session role (plan §7.1, §8.1, §13.2) ----------------------------------

export type Role = "responder" | "approver" | "observer";

// --- Runbook (plan §3.8) -----------------------------------------------------

export interface RunbookStep {
  n: number;
  text: string;
  toolHint: string | null;
}

export interface Runbook {
  id: string;
  title: string;
  symptoms: string[];
  services: ServiceId[];
  steps: RunbookStep[];
  lastReviewed: string;
}

// --- Incident (plan §3.9, §7) ------------------------------------------------

// Full lifecycle from plan §7.1. Phase 2 gives incidents a `state` field and a
// generic setter; the actual transition RULES (what's valid from where, the two
// reverse transitions) are Phase 6/7's job, not enforced yet.
export type IncidentState =
  | "TRIGGERED"
  | "OPEN"
  | "INVESTIGATING"
  | "DIAGNOSIS_FOUND"
  | "REMEDIATION_PROPOSED"
  | "WAITING_FOR_APPROVAL"
  | "MITIGATING"
  | "RECOVERING"
  | "MONITORING"
  | "RESOLVED";

export interface EvidenceRef {
  kind: "log" | "trace" | "metric_window" | "deployment" | "change";
  id: string;
  label: string;
}

export interface IncidentNote {
  id: string;
  atMinute: number;
  at: string;
  authorKind: "agent" | "human";
  author: string;
  note: string;
  evidenceRefs: EvidenceRef[];
}

export interface TimelineEvent {
  atMinute: number;
  at: string;
  source: "system" | "agent" | "human";
  summary: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: Severity;
  state: IncidentState;
  openedAtMinute: number;
  openedAt: string;
  resolvedAt: string | null;
  affectedServices: ServiceId[];
  assignee: string | null;
  notes: IncidentNote[];
  timeline: TimelineEvent[];
  // Deliberately absent: scenarioId, groundTruth. See plan §3.9 — an Incident
  // record is what the agent/console sees, and must never carry the answer key.
}

// --- Approval (plan §3.10) ---------------------------------------------------

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired" | "superseded";
export type Risk = "low" | "medium" | "high";

export interface Approval {
  id: string;
  incidentId: string;
  requestedAtMinute: number;
  requestedAt: string;
  requestedBy: "agent" | string;
  action: { tool: string; args: Record<string, unknown> };
  reason: string;
  evidenceRefs: EvidenceRef[];
  expectedEffect: string;
  notCovered: string;
  risk: Risk;
  status: ApprovalStatus;
  decidedAt: string | null;
  decidedBy: string | null;
  decisionNote: string | null;
  consumedAt: string | null;
}

// --- Audit record (plan §3.11) -----------------------------------------------

export type AuditOutcome = "allowed" | "denied" | "error";

export interface AuditRecord {
  seq: number;
  at: string;
  atMinute: number;
  actor: { kind: "agent" | "human"; identity: string; sessionId: string };
  tool: string;
  args: Record<string, unknown>;
  approvalId: string | null;
  outcome: AuditOutcome;
  denialReason: string | null;
  resultSummary: string;
  stateBefore: string | null;
  stateAfter: string | null;
}
