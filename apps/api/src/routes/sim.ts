import type { ScenarioId } from "../simEngine.js";
import { getScenario } from "../simEngine.js";
import { resetSessionTo } from "../store/session.js";

const KNOWN_SCENARIO_IDS: ScenarioId[] = ["INC-4821", "INC-4822", "INC-4823", "INC-4824", "INC-4825"];

function scenarioExists(id: string): id is ScenarioId {
  if (!(KNOWN_SCENARIO_IDS as string[]).includes(id)) return false;
  try {
    getScenario(id as ScenarioId); // all five are implemented; this stays as the guard against a listed-but-missing id
    return true;
  } catch {
    return false;
  }
}

/** Console-only. Deliberately never registered as a WebMCP tool — the agent
 * must not be able to reset the world or discover which scenario is loaded
 * (plan §11's `/api/sim/*` note, and §3.9's ban on leaking scenarioId). */
export async function loadScenario(sessionId: string, scenarioId: string | undefined, seed: string | undefined) {
  if (!scenarioId || !scenarioExists(scenarioId)) {
    return { status: 400, body: { error: `Unknown or not-yet-implemented scenario: "${scenarioId}".` } };
  }
  const seedNum = seed ? Number(seed) : 42;
  const fresh = await resetSessionTo(sessionId, scenarioId, seedNum);
  return { status: 200, body: { scenarioId: fresh.scenarioId, seed: fresh.seed, nowMinute: fresh.nowMinute } };
}

export async function resetToSeed(sessionId: string, currentScenarioId: ScenarioId, seed: string | undefined) {
  const seedNum = seed ? Number(seed) : 42;
  const fresh = await resetSessionTo(sessionId, currentScenarioId, seedNum);
  return { status: 200, body: { scenarioId: fresh.scenarioId, seed: fresh.seed, nowMinute: fresh.nowMinute } };
}
