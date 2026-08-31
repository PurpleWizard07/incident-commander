#!/usr/bin/env node
// Manual/agent-facing CLI: node evals/invoke.mjs <sessionId> <toolName> '<jsonArgs>'
// Prints the tool's result to stdout and appends {sessionId, tool, args, at,
// ok, result|error} to evals/traces/<sessionId>.jsonl — the trace log the
// eval grader reads afterward, independent of whatever the calling agent
// claims it did. This is what makes the eval's tool-call trace verifiable
// rather than self-reported.
import { callTool } from "./tools.mjs";
import { appendFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRACE_DIR = path.join(__dirname, "traces");

const [sessionId, toolName, argsJson] = process.argv.slice(2);

if (!sessionId || !toolName) {
  console.error('Usage: node evals/invoke.mjs <sessionId> <toolName> \'<jsonArgs>\'');
  process.exit(1);
}

let args = {};
if (argsJson) {
  try {
    args = JSON.parse(argsJson);
  } catch {
    console.error("Could not parse args as JSON:", argsJson);
    process.exit(1);
  }
}

function log(entry) {
  mkdirSync(TRACE_DIR, { recursive: true });
  appendFileSync(path.join(TRACE_DIR, `${sessionId}.jsonl`), JSON.stringify(entry) + "\n");
}

try {
  const result = await callTool(toolName, args, sessionId);
  log({ at: new Date().toISOString(), tool: toolName, args, ok: true, result });
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  log({ at: new Date().toISOString(), tool: toolName, args, ok: false, error: String(err.message ?? err) });
  console.error("ERROR:", err.message ?? err);
  process.exit(2);
}
