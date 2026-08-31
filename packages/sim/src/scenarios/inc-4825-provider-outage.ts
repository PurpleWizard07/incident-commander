import type { Deployment, Change, Alert } from "../sharedTypes.js";
import type { Scenario } from "../types.js";
import { FOREVER } from "../types.js";
import { isoForMinute } from "../clock.js";

// Timeline (plan §5.5), minutes relative to T0 = the provider's first 502.
export const OUTAGE_MINUTE = 0; // 16:12
export const SPIKE_MINUTE = 1; // 16:13
export const ALERT_MINUTE = 2; // 16:14
export const INCIDENT_OPEN_MINUTE = 3; // 16:15
export const NOW_MINUTE = 7; // 16:19

const deployments: Deployment[] = [];
const changes: Change[] = [];

const alerts: Alert[] = [
  {
    id: "ALERT-4825-provider-errors",
    name: "PaymentProviderErrors",
    service: "payments",
    metric: "external_call_error_rate",
    threshold: 0.3,
    comparator: ">",
    firedAtMinute: ALERT_MINUTE,
    firedAt: isoForMinute(ALERT_MINUTE),
    resolvedAt: null,
    severity: "SEV-1",
    incidentId: "INC-4825",
    currentValue: 0.78,
  },
];

export const INC_4825_SCENARIO: Scenario = {
  id: "INC-4825",
  title: "Payment provider failure",
  severity: "SEV-1",
  isHero: false,
  defaultNowMinute: NOW_MINUTE,
  openedAtMinute: INCIDENT_OPEN_MINUTE,
  affectedServices: ["payments"],

  groundTruth: {
    rootCause: "third-party provider northwind-pay is returning 502s — nothing we own is broken",
    causalService: "payments",
    causalChangeId: null,
    failingSpanName: "payments.http.northwind-pay",
    // The correct action is NO remediation tool at all — note + assign only.
    correctActions: [{ tool: "add_incident_note", argsMatch: {} }],
    incorrectButTempting: [
      { tool: "scale_service", argsMatch: { service: "payments" } },
      { tool: "restart_service", argsMatch: { service: "payments" } },
    ],
  },

  deployments,
  changes,
  alerts,
  runbookIds: ["RB-014"],

  phases: [
    { fromMinute: 0, toMinute: FOREVER, service: "payments", metric: "external_call_error_rate", shape: "step", from: 0.01, to: 0.78, jitter: 0.05 },
    { fromMinute: 0, toMinute: FOREVER, service: "payments", metric: "external_call_latency", shape: "step", from: 220, to: 30000, jitter: 0.02 },
    // Everything WE own stays normal — that absence is the whole diagnosis.
    { fromMinute: 0, toMinute: FOREVER, service: "payments", metric: "cpu", shape: "noise_only", from: 0.32, to: 0.32, jitter: 0.08 },
    { fromMinute: 0, toMinute: FOREVER, service: "payments", metric: "memory", shape: "noise_only", from: 0.4, to: 0.4, jitter: 0.06 },
    { fromMinute: 0, toMinute: FOREVER, service: "payments", metric: "latency_p50", shape: "noise_only", from: 45, to: 45, jitter: 0.05 },
    // The user-visible symptom: overall error_rate rises because the external call fails,
    // even though nothing internal is wrong.
    { fromMinute: 0, toMinute: SPIKE_MINUTE, service: "payments", metric: "error_rate", shape: "noise_only", from: 0.006, to: 0.006, jitter: 0.15 },
    { fromMinute: SPIKE_MINUTE, toMinute: FOREVER, service: "payments", metric: "error_rate", shape: "step", from: 0.006, to: 0.76, jitter: 0.04 },
    { fromMinute: 0, toMinute: FOREVER, service: "database", metric: "error_rate", shape: "noise_only", from: 0.001, to: 0.001, jitter: 0.2 },
  ],

  logTemplates: [
    {
      id: "payments-502",
      service: "payments",
      level: "ERROR",
      message: "Upstream provider returned 502 Bad Gateway (provider=northwind-pay, attempt=3/3)",
      ratePerMinute: 6,
      activeFrom: OUTAGE_MINUTE,
      activeTo: null,
      attachTrace: true,
    },
    {
      id: "payments-breaker-open",
      service: "payments",
      level: "WARN",
      message: "Circuit breaker for northwind-pay opened",
      ratePerMinute: 1,
      activeFrom: OUTAGE_MINUTE,
      activeTo: OUTAGE_MINUTE + 1,
      attachTrace: false,
    },
  ],

  traceShapes: [
    {
      id: "payments-provider-flow",
      rootService: "checkout",
      volumePerMinute: 2,
      activeFrom: 0,
      activeTo: null,
      spans: [
        { name: "checkout.callPayments", service: "checkout", parent: null, durationMsRange: [10, 30] },
        { name: "payments.processPayment", service: "payments", parent: "checkout.callPayments", durationMsRange: [10, 30] },
        {
          name: "payments.http.northwind-pay",
          service: "payments",
          parent: "payments.processPayment",
          durationMsRange: [200, 30000],
          resolve: (ctx) => {
            if (ctx.minute < OUTAGE_MINUTE) return { status: "ok" };
            return { status: "error", errorMessage: "502 Bad Gateway from northwind-pay" };
          },
        },
      ],
    },
  ],

  remediation: [
    {
      match: { tool: "disable_feature_flag", argsMatch: { service: "payments", flagName: "require_primary_provider" } },
      effect: "full_recovery",
      recoveryCurve: { toMinutes: 2, targetMultiplier: 1 },
      message: "Routed to the fallback provider. Error rate is dropping.",
    },
    { match: { tool: "rollback_deployment" }, effect: "rejected", message: "No deployment in the last six days across any service — there is nothing to roll back." },
    { match: { tool: "restart_service", argsMatch: { service: "payments" } }, effect: "no_effect", message: "Restart completed. The provider is still down — error rate is unchanged." },
    {
      match: { tool: "scale_service", argsMatch: { service: "payments" } },
      effect: "worsens",
      message: "Scaling completed, but this increases concurrent load against a failing upstream — error rate has gone up, not down.",
    },
  ],
};
