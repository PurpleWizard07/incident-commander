import type { ActionMatcher, RemediationRule, Scenario } from "./types.js";
import { DEFAULT_NO_EFFECT_RULE } from "./types.js";

function matchesAction(matcher: ActionMatcher, tool: string, args: Record<string, unknown>): boolean {
  if (matcher.tool !== "*" && matcher.tool !== tool) return false;
  if (!matcher.argsMatch) return true;
  return Object.entries(matcher.argsMatch).every(([key, value]) => args[key] === value);
}

/**
 * Resolves what happens when an agent invokes an action tool against a scenario.
 * First matching rule wins; an unmatched action defaults to `no_effect`
 * (plan §4.6) — this default is what makes wrong actions fail honestly.
 */
export function resolveAction(scenario: Scenario, tool: string, args: Record<string, unknown>): RemediationRule {
  for (const rule of scenario.remediation) {
    if (matchesAction(rule.match, tool, args)) return rule;
  }
  return DEFAULT_NO_EFFECT_RULE;
}
