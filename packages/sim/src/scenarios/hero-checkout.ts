import type { Deployment, Change, Alert } from "@incident-commander/shared";
import type { Scenario } from "../types.js";
import { FOREVER } from "../types.js";

// Timeline (plan §5.1), minutes relative to T0 = incident open - 90:
export const DEPLOY_MINUTE = 82; // 10:41 checkout-v3 deployed
export const ONSET_MINUTE = 85; // 10:44 checkout error rate begins rising (deploy + 3)
export const PAYMENTS_SPIKE_MINUTE = 88; // 10:47 payment failures spike
export const ALERT_MINUTE = 89; // 10:48 alert fires
export const INCIDENT_OPEN_MINUTE = 90; // 10:49 INC-4821 opened
export const NOW_MINUTE = 93; // 10:52 "now" in the hero demo

const PAYMENTS_V4_MINUTE = DEPLOY_MINUTE - 6 * 24 * 60; // "six days old"
const CHECKOUT_V2_MINUTE = DEPLOY_MINUTE - 4 * 24 * 60;

const deployments: Deployment[] = [
  {
    id: "checkout-v3",
    service: "checkout",
    version: "v3",
    deployedAtMinute: DEPLOY_MINUTE,
    deployedAt: "",
    deployedBy: "r.mehta",
    commitSha: "4a91c2f",
    commitMessage: "refactor payment token validation",
    status: "active",
    rollbackTargetId: "checkout-v2",
    changedFiles: 14,
    riskScore: "medium",
  },
  {
    id: "checkout-v2",
    service: "checkout",
    version: "v2",
    deployedAtMinute: CHECKOUT_V2_MINUTE,
    deployedAt: "",
    deployedBy: "a.silva",
    commitSha: "e10ab3f",
    commitMessage: "add retry on payment gateway timeout",
    status: "superseded",
    rollbackTargetId: "checkout-v1",
    changedFiles: 6,
    riskScore: "low",
  },
  {
    id: "payments-v4",
    service: "payments",
    version: "v4",
    deployedAtMinute: PAYMENTS_V4_MINUTE,
    deployedAt: "",
    deployedBy: "s.iyer",
    commitSha: "9c2fa41",
    commitMessage: "add fraud-check pre-validation",
    status: "active",
    rollbackTargetId: "payments-v3",
    changedFiles: 9,
    riskScore: "low",
  },
];

const changes: Change[] = [];

const alerts: Alert[] = [
  {
    id: "ALERT-4821-payment-error-rate",
    name: "PaymentErrorRateHigh",
    service: "payments",
    metric: "error_rate",
    threshold: 0.5,
    comparator: ">",
    firedAtMinute: ALERT_MINUTE,
    firedAt: "",
    resolvedAt: null,
    severity: "SEV-1",
    incidentId: "INC-4821",
    currentValue: 0.83,
  },
];

export const HERO_CHECKOUT_SCENARIO: Scenario = {
  id: "INC-4821",
  title: "Checkout degradation",
  severity: "SEV-1",
  isHero: true,

  groundTruth: {
    rootCause: "checkout-v3 introduced a payment-token validation regression",
    causalService: "checkout",
    causalChangeId: "checkout-v3",
    failingSpanName: "checkout.validatePaymentToken",
    correctActions: [
      { tool: "rollback_deployment", argsMatch: { service: "checkout", deploymentId: "checkout-v3" } },
    ],
    incorrectButTempting: [{ tool: "rollback_deployment", argsMatch: { service: "payments" } }],
  },

  deployments,
  changes,
  alerts,
  runbookIds: [],

  phases: [
    // checkout: healthy baseline, then a step at ONSET_MINUTE (deploy + 3)
    { fromMinute: 0, toMinute: ONSET_MINUTE, service: "checkout", metric: "error_rate", shape: "noise_only", from: 0.005, to: 0.005, jitter: 0.15 },
    { fromMinute: ONSET_MINUTE, toMinute: FOREVER, service: "checkout", metric: "error_rate", shape: "step", from: 0.005, to: 0.64, jitter: 0.05 },
    { fromMinute: 0, toMinute: FOREVER, service: "checkout", metric: "latency_p95", shape: "noise_only", from: 240, to: 240, jitter: 0.06 },
    { fromMinute: 0, toMinute: FOREVER, service: "checkout", metric: "db_pool_utilization", shape: "noise_only", from: 0.38, to: 0.38, jitter: 0.08 },

    // payments: healthy baseline, step ~3 minutes after checkout (downstream lag)
    { fromMinute: 0, toMinute: PAYMENTS_SPIKE_MINUTE, service: "payments", metric: "error_rate", shape: "noise_only", from: 0.006, to: 0.006, jitter: 0.15 },
    { fromMinute: PAYMENTS_SPIKE_MINUTE, toMinute: FOREVER, service: "payments", metric: "error_rate", shape: "step", from: 0.006, to: 0.83, jitter: 0.04 },
    { fromMinute: 0, toMinute: FOREVER, service: "payments", metric: "latency_p95", shape: "noise_only", from: 280, to: 280, jitter: 0.06 },

    // frontend: downstream aggregate, lags checkout by ~1 minute
    { fromMinute: 0, toMinute: ONSET_MINUTE + 1, service: "frontend", metric: "error_rate", shape: "noise_only", from: 0.004, to: 0.004, jitter: 0.15 },
    { fromMinute: ONSET_MINUTE + 1, toMinute: FOREVER, service: "frontend", metric: "error_rate", shape: "step", from: 0.004, to: 0.22, jitter: 0.06 },

    // untouched services: flat healthy baseline throughout
    { fromMinute: 0, toMinute: FOREVER, service: "auth", metric: "error_rate", shape: "noise_only", from: 0.002, to: 0.002, jitter: 0.2 },
    { fromMinute: 0, toMinute: FOREVER, service: "database", metric: "error_rate", shape: "noise_only", from: 0.001, to: 0.001, jitter: 0.2 },
    { fromMinute: 0, toMinute: FOREVER, service: "queue", metric: "error_rate", shape: "noise_only", from: 0.0, to: 0.0, jitter: 0 },
    { fromMinute: 0, toMinute: FOREVER, service: "notifications", metric: "error_rate", shape: "noise_only", from: 0.0, to: 0.0, jitter: 0 },
  ],

  logTemplates: [
    {
      id: "checkout-token-error",
      service: "checkout",
      level: "ERROR",
      message: "Payment token validation failed: unexpected token format (expected v2 envelope)",
      ratePerMinute: 6,
      activeFrom: ONSET_MINUTE,
      activeTo: null,
      onlyWhenDeployment: "checkout-v3",
      attachTrace: true,
    },
    {
      id: "payments-malformed-token",
      service: "payments",
      level: "ERROR",
      message: "Malformed token envelope received from upstream caller",
      ratePerMinute: 5,
      activeFrom: PAYMENTS_SPIKE_MINUTE,
      activeTo: null,
      attachTrace: true,
    },
    {
      id: "checkout-healthcheck",
      service: "checkout",
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
      id: "checkout-payment-flow",
      rootService: "frontend",
      volumePerMinute: 2.2,
      activeFrom: 0,
      activeTo: null,
      spans: [
        {
          name: "frontend.handleCheckout",
          service: "frontend",
          parent: null,
          durationMsRange: [20, 60],
        },
        {
          name: "checkout.validatePaymentToken",
          service: "checkout",
          parent: "frontend.handleCheckout",
          durationMsRange: [5, 20],
          resolve: (ctx) => {
            if (ctx.minute < DEPLOY_MINUTE) {
              return { status: "ok", attributes: { deployment: "checkout-v2" } };
            }
            // Rolling deploy overlap: a lingering fraction of traffic still hits v2 pods.
            if (ctx.rng.bool(0.12)) {
              return { status: "ok", attributes: { deployment: "checkout-v2" } };
            }
            if (ctx.minute < ONSET_MINUTE) {
              return { status: "ok", attributes: { deployment: "checkout-v3" } };
            }
            return {
              status: "error",
              errorMessage: "Payment token validation failed: unexpected token format (expected v2 envelope)",
              attributes: { deployment: "checkout-v3" },
            };
          },
        },
        {
          name: "checkout.callPayments",
          service: "checkout",
          parent: "checkout.validatePaymentToken",
          durationMsRange: [30, 80],
        },
        {
          name: "payments.processPayment",
          service: "payments",
          parent: "checkout.callPayments",
          durationMsRange: [40, 100],
        },
        {
          name: "payments.callDatabase",
          service: "payments",
          parent: "payments.processPayment",
          durationMsRange: [5, 15],
        },
        {
          name: "database.query",
          service: "database",
          parent: "payments.callDatabase",
          durationMsRange: [2, 8],
        },
      ],
    },
  ],

  remediation: [
    {
      match: { tool: "rollback_deployment", argsMatch: { service: "checkout", deploymentId: "checkout-v3" } },
      effect: "full_recovery",
      recoveryCurve: { toMinutes: 4, targetMultiplier: 1 },
      message: "Rollback completed. Checkout error rate is returning to baseline.",
    },
    {
      match: { tool: "rollback_deployment", argsMatch: { service: "payments" } },
      effect: "rejected",
      message: "No deployment exists for payments within the incident window — there is nothing to roll back.",
    },
    {
      match: { tool: "restart_service", argsMatch: { service: "checkout" } },
      effect: "no_effect",
      message: "Restart completed. The bad code redeployed along with the restart — error rate is unchanged.",
    },
    {
      match: { tool: "scale_service" },
      effect: "no_effect",
      message: "Scaling completed. Error rate is unchanged — this incident is not caused by capacity.",
    },
    {
      match: { tool: "disable_feature_flag" },
      effect: "rejected",
      message: "No feature flag is implicated in this incident.",
    },
  ],
};
