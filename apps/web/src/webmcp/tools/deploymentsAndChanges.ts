import { apiGet } from "../apiClient.js";
import { capText } from "../shape.js";
import { REASON_PROPERTY, SERVICE_ENUM, toolResult } from "./shared.js";

interface Deployment {
  id: string;
  service: string;
  version: string;
  deployedAt: string;
  deployedBy: string;
  commitMessage: string;
  status: string;
  rollbackTargetId: string | null;
  riskScore: string;
}

interface Change {
  id: string;
  type: string;
  service: string | null;
  at: string;
  actor: string;
  summary: string;
  before: string;
  after: string;
}

export const getRecentDeployments = {
  name: "get_recent_deployments",
  description:
    "Lists deployments for a service or across all services in a time window, with version, " +
    "deploy time, author, commit message, risk score, and rollback target. If this returns nothing " +
    "in the incident window, the cause is not a deployment — call get_recent_changes to check " +
    "feature flags, config, and scheduled jobs instead.",
  inputSchema: {
    type: "object",
    properties: {
      service: { type: "string", enum: SERVICE_ENUM, description: "Omit to check all services." },
      withinMinutes: { type: "number", description: "Look-back window in minutes. Default 120, max 4320." },
      reason: REASON_PROPERTY,
    },
    required: ["reason"],
  },
  annotations: { readOnlyHint: true },
  execute: async (input: Record<string, unknown>) => {
    const { deployments, note } = await apiGet<{ deployments: Deployment[]; note?: string }>("/api/deployments", {
      service: input.service as string | undefined,
      withinMinutes: input.withinMinutes !== undefined ? String(input.withinMinutes) : undefined,
    });
    if (deployments.length === 0) return toolResult(note ?? "No deployments in this window.");
    const lines = deployments.map(
      (d) => `${d.id} (${d.service}, ${d.status}, risk ${d.riskScore}) by ${d.deployedBy}: "${d.commitMessage}"${d.rollbackTargetId ? ` — rollback target: ${d.rollbackTargetId}` : " — no rollback target available"}`
    );
    return toolResult(capText(lines.join("\n")));
  },
};

export const getRecentChanges = {
  name: "get_recent_changes",
  description:
    "Lists non-deployment changes: feature flag rollouts, configuration edits, scaling operations, " +
    "scheduled job changes, and infrastructure work. Use whenever deployments do not explain the " +
    "timing of an incident — many production incidents are caused by changes that are not deploys.",
  inputSchema: {
    type: "object",
    properties: {
      service: { type: "string", enum: SERVICE_ENUM },
      withinMinutes: { type: "number", description: "Look-back window in minutes. Default 120." },
      type: { type: "string", enum: ["feature_flag", "config", "scaling", "scheduled_job", "infrastructure"] },
      reason: REASON_PROPERTY,
    },
    required: ["reason"],
  },
  annotations: { readOnlyHint: true },
  execute: async (input: Record<string, unknown>) => {
    const { changes } = await apiGet<{ changes: Change[] }>("/api/changes", {
      service: input.service as string | undefined,
      withinMinutes: input.withinMinutes !== undefined ? String(input.withinMinutes) : undefined,
      type: input.type as string | undefined,
    });
    if (changes.length === 0) return toolResult("No non-deployment changes in this window.");
    const lines = changes.map((c) => `${c.type} on ${c.service ?? "platform"} by ${c.actor}: ${c.summary} (${c.before} → ${c.after})`);
    return toolResult(capText(lines.join("\n")));
  },
};
