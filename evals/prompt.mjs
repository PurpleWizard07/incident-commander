#!/usr/bin/env node
// node evals/prompt.mjs <sessionId> <scenarioId> <tuned|naive>
// Prints the full eval-agent prompt to stdout, for pasting into a subagent
// call. Kept as a script (not hand-duplicated per call) so the 10 real runs
// use byte-identical scaffolding and only the description variant differs.
import { TUNED, NAIVE } from "./tool-descriptions.mjs";

const [sessionId, scenarioId, variant] = process.argv.slice(2);
if (!sessionId || !scenarioId || !["tuned", "naive"].includes(variant)) {
  console.error("Usage: node evals/prompt.mjs <sessionId> <scenarioId> <tuned|naive>");
  process.exit(1);
}

const DESCRIPTIONS = variant === "tuned" ? TUNED : NAIVE;

const SCHEMA = {
  get_active_incidents: `{ severity?: "SEV-1"|"SEV-2"|"SEV-3" }`,
  get_incident: `{ incidentId: string }`,
  get_incident_timeline: `{ incidentId: string, sinceMinute?: number }`,
  get_service_health: `{ service: string }`,
  get_service_dependencies: `{ service: string, direction?: "upstream"|"downstream"|"both" }`,
  get_recent_deployments: `{ service?: string, withinMinutes?: number }`,
  get_recent_changes: `{ service?: string, withinMinutes?: number, type?: "feature_flag"|"config"|"scaling"|"scheduled_job"|"infrastructure" }`,
  query_logs: `{ service?: string, level?: "DEBUG"|"INFO"|"WARN"|"ERROR"|"FATAL", contains?: string, fromMinute?: number, toMinute?: number, limit?: number }`,
  search_traces: `{ service?: string, status?: "ok"|"error"|"any", limit?: number }`,
  compare_metrics: `{ services?: string[], metrics?: string[], fromMinute?: number, toMinute?: number }`,
  inspect_alert: `{ alertId: string }`,
  get_runbook: `{ symptom?: string, service?: string, runbookId?: string }`,
  assign_incident: `{ incidentId: string, assignee: string }`,
  add_incident_note: `{ incidentId: string, note: string, evidenceRefs?: object[] }`,
  resolve_incident: `{ incidentId: string, resolutionSummary: string, rootCause: string }`,
  create_incident: `{ title: string, severity: "SEV-1"|"SEV-2"|"SEV-3", affectedServices: string[], description?: string }`,
  rollback_deployment: `{ service: string, deploymentId: string, approvalId: string }`,
  restart_service: `{ service: string, approvalId: string, strategy?: "rolling"|"all_at_once" }`,
  scale_service: `{ service: string, approvalId: string, instances?: number, poolSize?: number }`,
  disable_feature_flag: `{ service: string, flagName: string, approvalId: string }`,
  get_pending_approvals: `{ incidentId?: string }`,
  request_approval: `{ incidentId: string, tool: string, args: object, reason: string, evidenceRefs: object[], expectedEffect: string, notCovered: string, risk: "low"|"medium"|"high" }`,
  record_approval: `{ approvalId: string, decision: "approved"|"rejected", approvalToken: string }`,
};

const SERVICE_ENUM = ["frontend", "checkout", "payments", "auth", "database", "queue", "notifications"];

const toolLines = Object.keys(DESCRIPTIONS)
  .map((name) => `- ${name}${SCHEMA[name]}\n  ${DESCRIPTIONS[name]}`)
  .join("\n\n");

const prompt = `You are an on-call SRE agent investigating a live production incident through a fixed
set of WebMCP tools. You are being evaluated: act exactly as you would in a real incident, using
only the tools below and only the evidence they return.

## How to call a tool

From the repository root (c:/Users/varad/OneDrive/Desktop/webmcp), run:

  node evals/invoke.mjs ${sessionId} <toolName> '<jsonArgs>'

This is the ONLY way to call a tool — use the Bash tool to run it. It prints the tool's JSON
result to stdout and also mechanically logs the call to a trace file, so call it for real every
time; never fabricate what a tool "would have" returned. If a call fails (non-zero exit), the
error is printed — that is a real result (e.g. an unapproved action being correctly rejected), not
a bug for you to work around.

Services you may see: ${SERVICE_ENUM.join(", ")}.

## Available tools

${toolLines}

## Your task

An incident is already open in the system for scenario ${scenarioId} (do not create a new one).
Start with get_active_incidents to find its id, then investigate using whichever tools the
evidence calls for. Reach a diagnosis: what is the root cause, and what if anything should be
done about it. You do not need to (and should not) actually execute a gated remediation action
(rollback_deployment / restart_service / scale_service / disable_feature_flag) or resolve the
incident — recommending the right one is what's being evaluated, not completing the change. Adding
an add_incident_note with your findings is appropriate and encouraged once you've reached a
conclusion.

If the evidence is genuinely ambiguous or a correlation is weak, say so plainly in your note and
your summary — do not manufacture false confidence.

## Required final output

End your response with exactly one fenced JSON block, no other text inside it:

\`\`\`json
{
  "causalService": "<the service you determined is the root cause, or null if none>",
  "recommendedTool": "<one of rollback_deployment | restart_service | scale_service | disable_feature_flag | none>",
  "confidence": "<low | medium | high>",
  "summary": "<2-4 sentences: what happened, the evidence, and why you recommend what you recommend>"
}
\`\`\`
`;

console.log(prompt);
