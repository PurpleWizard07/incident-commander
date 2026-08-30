import type {
  ServiceId,
  MetricName,
  MetricSeries,
  LogEntry,
  Trace,
  Deployment,
  Change,
  Alert,
} from "@incident-commander/shared";
import type { Rng } from "./prng.js";

/** A phase/metric window never ends: use this as `toMinute` for "holds forever". */
export const FOREVER = 100_000;

// --- Metric phase shaping (plan §4.4) --------------------------------------

export type PhaseShape = "step" | "ramp" | "staircase" | "sawtooth" | "spike_train" | "noise_only";

export interface Phase {
  fromMinute: number;
  toMinute: number;
  service: ServiceId;
  metric: MetricName;
  shape: PhaseShape;
  from: number;
  to: number;
  jitter: number;
  params?: Record<string, number>;
}

// --- Log generation (plan §4.5) --------------------------------------------

export interface LogTemplate {
  /** Unique within a scenario — seeds this template's own independent rng stream. */
  id: string;
  service: ServiceId;
  level: LogEntry["level"];
  message: string;
  ratePerMinute: number | ((minute: number) => number);
  activeFrom: number;
  activeTo: number | null;
  onlyWhenDeployment?: string;
  onlyWhenFlagEnabled?: string;
  attachTrace: boolean;
}

// --- Trace generation (plan §4.5 / §3.5) -----------------------------------

export interface TraceRequestContext {
  minute: number;
  rng: Rng;
  /** Set by the generator as it walks the tree: name -> resolved outcome so far. */
  resolved: Map<string, SpanOutcome>;
}

export interface SpanOutcome {
  status: "ok" | "error";
  errorMessage?: string;
  attributes?: Record<string, string | number | boolean>;
}

export interface TraceSpanSpec {
  name: string;
  service: ServiceId;
  parent: string | null;
  durationMsRange: [number, number];
  /** Defaults to always-ok with no extra attributes. */
  resolve?: (ctx: TraceRequestContext) => SpanOutcome;
}

export interface TraceShape {
  id: string;
  rootService: ServiceId;
  spans: TraceSpanSpec[];
  volumePerMinute: number;
  activeFrom: number;
  activeTo: number | null;
}

// --- Remediation (plan §4.6) ------------------------------------------------

export interface ActionMatcher {
  tool: string;
  argsMatch?: Record<string, unknown>;
}

export type RemediationEffect = "full_recovery" | "partial_recovery" | "no_effect" | "worsens" | "rejected";

export interface RecoveryCurve {
  toMinutes: number;
  targetMultiplier: number;
}

export interface RemediationRule {
  match: ActionMatcher;
  effect: RemediationEffect;
  recoveryCurve?: RecoveryCurve;
  regressionAfterMinutes?: number;
  message: string;
}

export const DEFAULT_NO_EFFECT_RULE: RemediationRule = {
  match: { tool: "*" },
  effect: "no_effect",
  message: "The action completed, but the metrics most relevant to this incident did not change.",
};

// --- Scenario (plan §4.3) ---------------------------------------------------

export type ScenarioId = "INC-4821" | "INC-4822" | "INC-4823" | "INC-4824" | "INC-4825";

export interface GroundTruth {
  rootCause: string;
  causalService: ServiceId;
  causalChangeId: string | null;
  failingSpanName: string;
  correctActions: ActionMatcher[];
  incorrectButTempting: ActionMatcher[];
}

export interface Scenario {
  id: ScenarioId;
  title: string;
  severity: "SEV-1" | "SEV-2" | "SEV-3";
  isHero: boolean;
  groundTruth: GroundTruth;
  phases: Phase[];
  logTemplates: LogTemplate[];
  traceShapes: TraceShape[];
  changes: Change[];
  deployments: Deployment[];
  alerts: Alert[];
  runbookIds: string[];
  remediation: RemediationRule[];
  spontaneousRecoveryAt?: number;
}

// --- Materialized world (the engine's output at a point in time) -----------

export interface World {
  scenarioId: ScenarioId;
  seed: number;
  nowMinute: number;
  services: Record<ServiceId, { status: "healthy" | "degraded" | "down"; errorRate: number }>;
  metrics: MetricSeries[];
  logs: LogEntry[];
  traces: Trace[];
  deployments: Deployment[];
  changes: Change[];
  alerts: Alert[];
}
