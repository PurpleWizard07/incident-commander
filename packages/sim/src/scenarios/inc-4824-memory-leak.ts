import type { Deployment, Change, Alert } from "../sharedTypes.js";
import type { Scenario } from "../types.js";
import { FOREVER } from "../types.js";
import { isoForMinute } from "../clock.js";

// Timeline (plan §5.4), minutes relative to T0 = the observation window start (14:00).
export const DEPLOY_MINUTE = -3 * 24 * 60; // notifications-v11, three days earlier — weak correlation
export const GC_RISING_MINUTE = 210; // 17:30
export const FIRST_OOM_MINUTE = 310; // 19:10
export const SECOND_OOM_MINUTE = 345; // 19:45
export const ALERT_MINUTE = 362; // 20:02
export const INCIDENT_OPEN_MINUTE = 364; // 20:04
export const NOW_MINUTE = 372; // 20:12

const deployments: Deployment[] = [
  {
    id: "notifications-v11",
    service: "notifications",
    version: "v11",
    deployedAtMinute: DEPLOY_MINUTE,
    deployedAt: isoForMinute(DEPLOY_MINUTE),
    deployedBy: "k.chen",
    commitSha: "b420f11",
    commitMessage: "batch digest emails before send",
    status: "active",
    rollbackTargetId: "notifications-v10",
    changedFiles: 11,
    riskScore: "medium",
  },
];

const changes: Change[] = [];

const alerts: Alert[] = [
  {
    id: "ALERT-4824-queue-depth",
    name: "QueueDepthCritical",
    service: "queue",
    metric: "queue_depth",
    threshold: 300,
    comparator: ">",
    firedAtMinute: ALERT_MINUTE,
    firedAt: isoForMinute(ALERT_MINUTE),
    resolvedAt: null,
    severity: "SEV-2",
    incidentId: "INC-4824",
    currentValue: 480,
  },
];

export const INC_4824_SCENARIO: Scenario = {
  id: "INC-4824",
  title: "Notification backlog",
  severity: "SEV-2",
  isHero: false,
  defaultNowMinute: NOW_MINUTE,
  openedAtMinute: INCIDENT_OPEN_MINUTE,
  affectedServices: ["notifications", "queue"],

  groundTruth: {
    rootCause: "a memory leak in notifications causes repeated OOM restarts and a growing queue backlog",
    causalService: "notifications",
    causalChangeId: "notifications-v11",
    // Deliberately no single dominant failing span (plan §5.4) — the trace surface
    // legitimately cannot answer this one; see the `runbookIds`-free / scattered
    // `traceShapes` below, which is what makes this true rather than asserted.
    failingSpanName: "",
    correctActions: [{ tool: "restart_service", argsMatch: { service: "notifications" } }],
    incorrectButTempting: [],
  },

  deployments,
  changes,
  alerts,
  runbookIds: [],

  phases: [
    // Sawtooth with a rising floor: each OOM restart resets memory, but never back to
    // baseline — the floor itself climbs every cycle. period=155 puts the first peak
    // (near the 0.95 ceiling) right around FIRST_OOM_MINUTE, matching the OOMKill log.
    {
      fromMinute: 0,
      toMinute: FOREVER,
      service: "notifications",
      metric: "memory",
      shape: "sawtooth",
      from: 0.42,
      to: 0.95,
      jitter: 0.03,
      params: { periodMinutes: 155, floorRisePerCycle: 0.15 },
    },
    { fromMinute: 0, toMinute: NOW_MINUTE, service: "notifications", metric: "gc_pause_ms", shape: "ramp", from: 40, to: 2400, jitter: 0.1 },
    { fromMinute: 0, toMinute: NOW_MINUTE, service: "queue", metric: "queue_depth", shape: "ramp", from: 5, to: 480, jitter: 0.1 },
    { fromMinute: 0, toMinute: FOREVER, service: "notifications", metric: "error_rate", shape: "noise_only", from: 0.08, to: 0.08, jitter: 0.3 },
    { fromMinute: 0, toMinute: FOREVER, service: "queue", metric: "error_rate", shape: "noise_only", from: 0.02, to: 0.02, jitter: 0.3 },

    // Untouched.
    { fromMinute: 0, toMinute: FOREVER, service: "checkout", metric: "error_rate", shape: "noise_only", from: 0.005, to: 0.005, jitter: 0.15 },
  ],

  logTemplates: [
    {
      id: "notifications-oom-1",
      service: "notifications",
      level: "FATAL",
      message: "OOMKilled, restarting container (rss=1.94GiB limit=2GiB)",
      ratePerMinute: 1,
      activeFrom: FIRST_OOM_MINUTE,
      activeTo: FIRST_OOM_MINUTE + 1,
      attachTrace: false,
    },
    {
      id: "notifications-oom-2",
      service: "notifications",
      level: "FATAL",
      message: "OOMKilled, restarting container (rss=1.96GiB limit=2GiB)",
      ratePerMinute: 1,
      activeFrom: SECOND_OOM_MINUTE,
      activeTo: SECOND_OOM_MINUTE + 1,
      attachTrace: false,
    },
    {
      id: "notifications-gc-pause",
      service: "notifications",
      level: "WARN",
      message: "GC pause 2412ms exceeded threshold",
      ratePerMinute: 2,
      activeFrom: GC_RISING_MINUTE,
      activeTo: null,
      attachTrace: false,
    },
    {
      id: "notifications-healthcheck",
      service: "notifications",
      level: "INFO",
      message: "healthcheck ok",
      ratePerMinute: 1,
      activeFrom: 0,
      activeTo: null,
      attachTrace: false,
    },
  ],

  traceShapes: [
    {
      id: "notifications-send-flow",
      rootService: "queue",
      volumePerMinute: 1.5,
      activeFrom: 0,
      activeTo: null,
      spans: [
        { name: "queue.dequeue", service: "queue", parent: null, durationMsRange: [1, 5] },
        {
          name: "notifications.renderDigest",
          service: "notifications",
          parent: "queue.dequeue",
          durationMsRange: [10, 40],
          // Scattered timeouts, deliberately no single dominant failing span: as memory
          // pressure rises, roughly a THIRD of requests fail here...
          resolve: (ctx) => {
            const pressure = Math.min(1, Math.max(0, ctx.minute / 372));
            if (ctx.rng.bool(pressure * 0.12)) {
              return { status: "error", errorMessage: "GC pause exceeded request deadline" };
            }
            return { status: "ok" };
          },
        },
        {
          name: "notifications.sendEmail",
          service: "notifications",
          parent: "notifications.renderDigest",
          durationMsRange: [15, 60],
          // ...and roughly another third fail here instead, at a different span entirely.
          resolve: (ctx) => {
            const pressure = Math.min(1, Math.max(0, ctx.minute / 372));
            if (ctx.rng.bool(pressure * 0.12)) {
              return { status: "error", errorMessage: "connection reset sending to SMTP relay" };
            }
            return { status: "ok" };
          },
        },
      ],
    },
  ],

  remediation: [
    {
      match: { tool: "restart_service", argsMatch: { service: "notifications" } },
      effect: "partial_recovery",
      recoveryCurve: { toMinutes: 3, targetMultiplier: 3 },
      message: "Restart completed. Queue is draining and memory has dropped, but this does not fix the underlying leak — expect it to climb again.",
    },
    {
      match: { tool: "scale_service", argsMatch: { service: "notifications" } },
      effect: "partial_recovery",
      recoveryCurve: { toMinutes: 4, targetMultiplier: 4 },
      message: "Scaled out. More headroom before the next OOM, but the leak itself is unaddressed.",
    },
    {
      match: { tool: "rollback_deployment", argsMatch: { service: "notifications", deploymentId: "notifications-v11" } },
      effect: "full_recovery",
      recoveryCurve: { toMinutes: 12, targetMultiplier: 1 },
      message: "Rollback started. This will take longer than usual — instances are cycling gradually.",
    },
    {
      match: { tool: "disable_feature_flag" },
      effect: "rejected",
      message: "No feature flag is implicated in this incident.",
    },
  ],
};
