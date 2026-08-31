#!/usr/bin/env node
// node evals/grade.mjs <scenarioId> <sessionId> <reportJsonPath>
// Reads the mechanical trace log (what actually happened) and the agent's
// structured final report (what it concluded), grades both against
// cases.mjs, and prints a JSON summary.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CASES } from "./cases.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [scenarioId, sessionId, reportPath] = process.argv.slice(2);

if (!scenarioId || !sessionId) {
  console.error("Usage: node evals/grade.mjs <scenarioId> <sessionId> <reportJsonPath>");
  process.exit(1);
}

const traceFile = path.join(__dirname, "traces", `${sessionId}.jsonl`);
const trace = existsSync(traceFile)
  ? readFileSync(traceFile, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l))
  : [];
const report = reportPath && existsSync(reportPath) ? JSON.parse(readFileSync(reportPath, "utf8")) : null;

const cases = CASES[scenarioId] ?? [];
const results = cases.map((c) => ({ id: c.id, description: c.description, pass: !!c.grade(trace, report) }));
const passCount = results.filter((r) => r.pass).length;

console.log(JSON.stringify({ scenarioId, sessionId, toolCallCount: trace.length, passCount, total: results.length, results }, null, 2));
