import type { Deployment, Change, Alert } from "../sharedTypes.js";
import type { Scenario } from "../types.js";
import { FOREVER } from "../types.js";
import { isoForMinute } from "../clock.js";

// Timeline (plan §5.3), minutes relative to T0 = first flag ramp.
export const FLAG_50_MINUTE = 0; // 09:30 flag 5% -> 50%
export const STEP1_MINUTE = 3; // 09:33 error rate steps up
export const FLAG_100_MINUTE = 15; // 09:45 flag 50% -> 100%
export const STEP2_MINUTE = 18; // 09:48 error rate steps up again
export const ALERT_MINUTE = 22;
export const INCIDENT_OPEN_MINUTE = 23;
export const NOW_MINUTE = 28;

const OLD_CHECKOUT_DEPLOY_MINUTE = FLAG_50_MINUTE - 4 * 24 * 60; // four days before the incident

/** Rollout fraction of `new_checkout_pricing` at a given minute — matches the two changes below. */
function rolloutFraction(minute: number): number {
  if (minute < FLAG_50_MINUTE) return 0.05;
  if (minute < FLAG_100_MINUTE) return 0.5;
  return 1.0;
}

const deployments: Deployment[] = [
  {
    id: "checkout-v5",
    service: "checkout",
    version: "v5",
    deployedAtMinute: OLD_CHECKOUT_DEPLOY_MINUTE,
    deployedAt: isoForMinute(OLD_CHECKOUT_DEPLOY_MINUTE),
    deployedBy: "a.silva",
    commitSha: "6f10eaa",
    commitMessage: "cache warm product catalog on boot",
    status: "active",
    rollbackTargetId: null,
    changedFiles: 3,
    riskScore: "low",
  },
];

const changes: Change[] = [
  {
    id: "CHG-4823-flag-50",
    type: "feature_flag",
    service: "checkout",
    atMinute: FLAG_50_MINUTE,
    at: isoForMinute(FLAG_50_MINUTE),
    actor: "d.kaur",
    summary: "new_checkout_pricing rollout increased",
    before: "5%",
    after: "50%",
  },
  {
    id: "CHG-4823-flag-100",
    type: "feature_flag",
    service: "checkout",
    atMinute: FLAG_100_MINUTE,
    at: isoForMinute(FLAG_100_MINUTE),
    actor: "d.kaur",
    summary: "new_checkout_pricing rollout increased",
    before: "50%",
    after: "100%",
  },
];

const alerts: Alert[] = [
  {
    id: "ALERT-4823-checkout-error-rate",
    name: "CheckoutErrorRateHigh",
    service: "checkout",
    metric: "error_rate",
    threshold: 0.1,
    comparator: ">",
    firedAtMinute: ALERT_MINUTE,
    firedAt: isoForMinute(ALERT_MINUTE),
    resolvedAt: null,
    severity: "SEV-2",
    incidentId: "INC-4823",
    currentValue: 0.47,
  },
];

export const INC_4823_SCENARIO: Scenario = {
  id: "INC-4823",
  title: "Checkout pricing errors",
  severity: "SEV-2",
  isHero: false,
  defaultNowMinute: NOW_MINUTE,
  openedAtMinute: INCIDENT_OPEN_MINUTE,
  affectedServices: ["checkout"],

  groundTruth: {
    rootCause: "new_checkout_pricing feature flag ramped to 100% and the new pricing engine cannot find rule set v2-tiered",
    causalService: "checkout",
    causalChangeId: "CHG-4823-flag-100",
    failingSpanName: "checkout.applyPricing",
    correctActions: [{ tool: "disable_feature_flag", argsMatch: { service: "checkout", flagName: "new_checkout_pricing" } }],
    incorrectButTempting: [{ tool: "rollback_deployment", argsMatch: { service: "checkout" } }],
  },

  deployments,
  changes,
  alerts,
  runbookIds: [],

  phases: [
    // The staircase: three flat steps matching each rollout stage exactly, not the engine's
    // evenly-spaced built-in "staircase" shape — chained "step" phases give precise control
    // over each step's actual value, and the model already supports this with zero new code.
    { fromMinute: 0, toMinute: STEP1_MINUTE, service: "checkout", metric: "error_rate", shape: "noise_only", from: 0.004, to: 0.004, jitter: 0.1 },
    { fromMinute: STEP1_MINUTE, toMinute: STEP2_MINUTE, service: "checkout", metric: "error_rate", shape: "step", from: 0.004, to: 0.046, jitter: 0.05 },
    { fromMinute: STEP2_MINUTE, toMinute: FOREVER, service: "checkout", metric: "error_rate", shape: "step", from: 0.046, to: 0.47, jitter: 0.03 },
    { fromMinute: 0, toMinute: FOREVER, service: "checkout", metric: "latency_p95", shape: "noise_only", from: 230, to: 230, jitter: 0.06 },

    // Nothing else moves — this incident is scoped to checkout alone.
    { fromMinute: 0, toMinute: FOREVER, service: "payments", metric: "error_rate", shape: "noise_only", from: 0.005, to: 0.005, jitter: 0.15 },
    { fromMinute: 0, toMinute: FOREVER, service: "frontend", metric: "error_rate", shape: "noise_only", from: 0.004, to: 0.004, jitter: 0.15 },
  ],

  logTemplates: [
    {
      id: "checkout-pricing-error",
      service: "checkout",
      level: "ERROR",
      message: "PricingEngineError: rule set 'v2-tiered' not found in catalog",
      ratePerMinute: (minute) => (minute < STEP2_MINUTE ? 2 : 8),
      activeFrom: STEP1_MINUTE,
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
      id: "checkout-pricing-flow",
      rootService: "frontend",
      volumePerMinute: 2.5,
      activeFrom: 0,
      activeTo: null,
      spans: [
        { name: "frontend.handleCheckout", service: "frontend", parent: null, durationMsRange: [15, 50] },
        { name: "checkout.processOrder", service: "checkout", parent: "frontend.handleCheckout", durationMsRange: [10, 30] },
        {
          name: "checkout.applyPricing",
          service: "checkout",
          parent: "checkout.processOrder",
          durationMsRange: [5, 25],
          resolve: (ctx) => {
            const enrolled = ctx.rng.bool(rolloutFraction(ctx.minute));
            if (enrolled && ctx.minute >= STEP1_MINUTE) {
              return {
                status: "error",
                errorMessage: "PricingEngineError: rule set 'v2-tiered' not found in catalog",
                attributes: { "flag.new_checkout_pricing": true },
              };
            }
            return { status: "ok", attributes: { "flag.new_checkout_pricing": enrolled } };
          },
        },
      ],
    },
  ],

  remediation: [
    {
      match: { tool: "disable_feature_flag", argsMatch: { service: "checkout", flagName: "new_checkout_pricing" } },
      effect: "full_recovery",
      recoveryCurve: { toMinutes: 2, targetMultiplier: 1 },
      message: "Flag disabled. Checkout error rate is dropping.",
    },
    {
      match: { tool: "rollback_deployment", argsMatch: { service: "checkout" } },
      effect: "rejected",
      message: "The active checkout deployment predates this incident by four days — there is nothing recent to roll back.",
    },
    {
      match: { tool: "restart_service", argsMatch: { service: "checkout" } },
      effect: "no_effect",
      message: "Restart completed. Flag state lives outside the process — error rate is unchanged.",
    },
    {
      match: { tool: "scale_service" },
      effect: "no_effect",
      message: "Scaling completed. This is not a capacity issue — error rate is unchanged.",
    },
  ],
};
