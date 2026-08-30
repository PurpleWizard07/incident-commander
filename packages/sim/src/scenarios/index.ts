import type { Scenario, ScenarioId } from "../types.js";
import { HERO_CHECKOUT_SCENARIO } from "./hero-checkout.js";

export { HERO_CHECKOUT_SCENARIO } from "./hero-checkout.js";
export * from "./hero-checkout.js";

/** Only the hero scenario exists in Phase 1. Scenarios 2-5 are added in Phase 8
 * as pure data, per plan §5 — this registry is what makes that "just data". */
export const SCENARIOS: Partial<Record<ScenarioId, Scenario>> = {
  "INC-4821": HERO_CHECKOUT_SCENARIO,
};

export function getScenario(id: ScenarioId): Scenario {
  const scenario = SCENARIOS[id];
  if (!scenario) throw new Error(`Unknown or not-yet-implemented scenario: ${id}`);
  return scenario;
}
