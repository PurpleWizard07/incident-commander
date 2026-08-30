import { describe, it, expect } from "vitest";
import { resolveAction } from "../src/remediation.js";
import { HERO_CHECKOUT_SCENARIO } from "../src/scenarios/hero-checkout.js";

const scenario = HERO_CHECKOUT_SCENARIO;

describe("remediation resolution — INC-4821 (plan §4.6, §5.1)", () => {
  it("resolves the correct rollback to full_recovery", () => {
    const rule = resolveAction(scenario, "rollback_deployment", { service: "checkout", deploymentId: "checkout-v3" });
    expect(rule.effect).toBe("full_recovery");
    expect(rule.recoveryCurve?.toMinutes).toBe(4);
  });

  it("rejects rolling back payments — there is nothing to roll back", () => {
    const rule = resolveAction(scenario, "rollback_deployment", { service: "payments", deploymentId: "payments-v4" });
    expect(rule.effect).toBe("rejected");
  });

  it("makes restarting checkout a no-op — the fault is in the code, not process state", () => {
    const rule = resolveAction(scenario, "restart_service", { service: "checkout" });
    expect(rule.effect).toBe("no_effect");
  });

  it("makes scaling any service a no-op — this is not a capacity incident", () => {
    expect(resolveAction(scenario, "scale_service", { service: "checkout", instances: 12 }).effect).toBe("no_effect");
    expect(resolveAction(scenario, "scale_service", { service: "database", poolSize: 200 }).effect).toBe("no_effect");
  });

  it("rejects disabling any feature flag — none is implicated", () => {
    const rule = resolveAction(scenario, "disable_feature_flag", { service: "checkout", flagName: "anything" });
    expect(rule.effect).toBe("rejected");
  });

  it("falls back to the default no_effect rule for an action no explicit rule covers", () => {
    const rule = resolveAction(scenario, "restart_service", { service: "auth" });
    expect(rule.effect).toBe("no_effect");
  });

  it("only rewards the exact correct action — a rollback of the right service but wrong deployment id does not match the recovery rule", () => {
    const rule = resolveAction(scenario, "rollback_deployment", { service: "checkout", deploymentId: "checkout-v2" });
    expect(rule.effect).not.toBe("full_recovery");
  });
});
