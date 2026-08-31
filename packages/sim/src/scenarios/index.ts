import type { Scenario, ScenarioId } from "../types.js";
import { HERO_CHECKOUT_SCENARIO } from "./hero-checkout.js";
import { INC_4822_SCENARIO } from "./inc-4822-pool-exhaustion.js";
import { INC_4823_SCENARIO } from "./inc-4823-pricing-flag.js";
import { INC_4824_SCENARIO } from "./inc-4824-memory-leak.js";
import { INC_4825_SCENARIO } from "./inc-4825-provider-outage.js";

export { HERO_CHECKOUT_SCENARIO } from "./hero-checkout.js";
// Each scenario file's own minute constants (ALERT_MINUTE, NOW_MINUTE, etc.) are
// intentionally NOT re-exported here — every scenario names them the same way,
// so a wildcard re-export collides across files. Nothing outside a scenario's
// own module needs them; only the *_SCENARIO objects themselves are shared.
export { INC_4822_SCENARIO } from "./inc-4822-pool-exhaustion.js";
export { INC_4823_SCENARIO } from "./inc-4823-pricing-flag.js";
export { INC_4824_SCENARIO } from "./inc-4824-memory-leak.js";
export { INC_4825_SCENARIO } from "./inc-4825-provider-outage.js";

/** Phase 8: scenarios 2-5, added as pure data per plan §5 — no engine changes were needed. */
export const SCENARIOS: Partial<Record<ScenarioId, Scenario>> = {
  "INC-4821": HERO_CHECKOUT_SCENARIO,
  "INC-4822": INC_4822_SCENARIO,
  "INC-4823": INC_4823_SCENARIO,
  "INC-4824": INC_4824_SCENARIO,
  "INC-4825": INC_4825_SCENARIO,
};

export function getScenario(id: ScenarioId): Scenario {
  const scenario = SCENARIOS[id];
  if (!scenario) throw new Error(`Unknown or not-yet-implemented scenario: ${id}`);
  return scenario;
}
