#!/usr/bin/env node
// node evals/preload.mjs <sessionId> <scenarioId> <seed>
// Loads a scenario into a fresh eval session — the orchestrator's job, not
// the eval agent's: a real agent never gets to pick its own scenario either
// (/api/sim/* is console-only, plan §11), so the eval shouldn't let it.
import { loadScenario } from "./tools.mjs";

const [sessionId, scenarioId, seed] = process.argv.slice(2);
if (!sessionId || !scenarioId) {
  console.error("Usage: node evals/preload.mjs <sessionId> <scenarioId> [seed]");
  process.exit(1);
}

const result = await loadScenario(scenarioId, seed ? Number(seed) : 42, sessionId);
console.log(JSON.stringify(result));
