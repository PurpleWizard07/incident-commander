import { apiPost } from "../apiClient.js";
import { toolResult } from "./shared.js";

const SERVICE_ENUM = ["frontend", "checkout", "payments", "auth", "database", "queue", "notifications"];

interface ActionResult {
  effect: string;
  message: string;
  recoveryCurve: { toMinutes: number; targetMultiplier: number } | null;
}

function describeAction(r: ActionResult): string {
  return r.effect === "full_recovery" || r.effect === "partial_recovery"
    ? `${r.message} Verify with compare_metrics before resolving.`
    : r.message;
}

export const rollbackDeployment = {
  name: "rollback_deployment",
  description:
    "Rolls a service back to its previous deployment. Requires an approved authorization; call " +
    "request_approval first with your evidence. Fails if no rollback target exists or the " +
    "deployment is already rolled back. Only use when evidence shows the deployment preceded the " +
    "symptoms.",
  inputSchema: {
    type: "object",
    properties: {
      service: { type: "string", enum: SERVICE_ENUM },
      deploymentId: { type: "string" },
      approvalId: { type: "string" },
    },
    required: ["service", "deploymentId", "approvalId"],
  },
  annotations: { readOnlyHint: false },
  execute: async (input: Record<string, unknown>) => {
    const r = await apiPost<ActionResult>("/api/actions/rollback", input);
    return toolResult(describeAction(r));
  },
};

export const restartService = {
  name: "restart_service",
  description:
    "Performs a rolling restart of a service's instances. Requires an approved authorization. A " +
    "restart clears in-process state such as leaked memory or held connections, but does not " +
    "change code or configuration — if the underlying cause persists, the symptom will return.",
  inputSchema: {
    type: "object",
    properties: {
      service: { type: "string", enum: SERVICE_ENUM },
      approvalId: { type: "string" },
      strategy: { type: "string", enum: ["rolling", "all_at_once"], description: "Default rolling." },
    },
    required: ["service", "approvalId"],
  },
  annotations: { readOnlyHint: false },
  execute: async (input: Record<string, unknown>) => {
    const r = await apiPost<ActionResult>("/api/actions/restart", input);
    return toolResult(describeAction(r));
  },
};

export const scaleService = {
  name: "scale_service",
  description:
    "Changes a service's instance count or resource pool size. Requires an approved authorization. " +
    "Use to relieve saturation such as an exhausted connection pool. Scaling does not help when the " +
    "bottleneck is external, and can worsen an incident by increasing load on a failing dependency.",
  inputSchema: {
    type: "object",
    properties: {
      service: { type: "string", enum: SERVICE_ENUM },
      approvalId: { type: "string" },
      instances: { type: "number" },
      poolSize: { type: "number", description: "For the database service: maximum connection pool size." },
    },
    required: ["service", "approvalId"],
  },
  annotations: { readOnlyHint: false },
  execute: async (input: Record<string, unknown>) => {
    const r = await apiPost<ActionResult>("/api/actions/scale", input);
    return toolResult(describeAction(r));
  },
};

export const disableFeatureFlag = {
  name: "disable_feature_flag",
  description:
    "Disables a feature flag or sets its rollout percentage to zero. Requires an approved " +
    "authorization. Use when error rates correlate with a flag's rollout rather than with a " +
    "deployment. Find candidate flags with get_recent_changes or get_runbook.",
  inputSchema: {
    type: "object",
    properties: {
      service: { type: "string", enum: SERVICE_ENUM },
      flagName: { type: "string" },
      approvalId: { type: "string" },
    },
    required: ["service", "flagName", "approvalId"],
  },
  annotations: { readOnlyHint: false },
  execute: async (input: Record<string, unknown>) => {
    const r = await apiPost<ActionResult>("/api/actions/flag", input);
    return toolResult(describeAction(r));
  },
};

export const resolveIncident = {
  name: "resolve_incident",
  description:
    "Marks an incident resolved. Only valid from the MONITORING state, after a remediation has " +
    "been executed and verified with compare_metrics. Do not resolve an incident whose metrics are " +
    "still recovering or whose cause was mitigated rather than fixed — add a note and leave it open " +
    "instead.",
  inputSchema: {
    type: "object",
    properties: {
      incidentId: { type: "string" },
      resolutionSummary: { type: "string" },
      rootCause: { type: "string" },
    },
    required: ["incidentId", "resolutionSummary", "rootCause"],
  },
  annotations: { readOnlyHint: false },
  execute: async (input: Record<string, unknown>) => {
    await apiPost(`/api/incidents/${encodeURIComponent(String(input.incidentId))}/resolve`, { ...input, actorKind: "agent" });
    return toolResult(`${input.incidentId} resolved.`);
  },
};
