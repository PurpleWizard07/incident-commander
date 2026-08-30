import { apiGet, apiPost } from "../apiClient.js";
import { capText } from "../shape.js";
import { REASON_PROPERTY, toolResult } from "./shared.js";

const GATED_TOOL_ENUM = ["rollback_deployment", "restart_service", "scale_service", "disable_feature_flag"];

interface PendingApproval {
  id: string;
  incidentId: string;
  action: { tool: string; args: Record<string, unknown> };
  risk: string;
  status: string;
}

export const getPendingApprovals = {
  name: "get_pending_approvals",
  description:
    "Lists authorization requests awaiting a human decision, with their proposed action, risk, and " +
    "current status. Use to check whether a request you submitted has been approved, rejected, or " +
    "expired before attempting the action.",
  inputSchema: {
    type: "object",
    properties: {
      incidentId: { type: "string" },
      reason: REASON_PROPERTY,
    },
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  execute: async (input: Record<string, unknown>) => {
    const { approvals } = await apiGet<{ approvals: PendingApproval[] }>("/api/approvals", {
      incidentId: input.incidentId as string | undefined,
    });
    if (approvals.length === 0) return toolResult("No pending approvals.");
    const lines = approvals.map((a) => `${a.id}: ${a.action.tool}(${JSON.stringify(a.action.args)}) — risk ${a.risk}, ${a.status}`);
    return toolResult(capText(lines.join("\n")));
  },
};

export const requestApproval = {
  name: "request_approval",
  description:
    "Submits a proposed production-changing action for human authorization, with your reasoning, " +
    "the evidence supporting it, its expected effect, and what it does not address. Returns an " +
    "approval id in pending state. The action itself will not execute until a human approves in " +
    "the console.",
  inputSchema: {
    type: "object",
    properties: {
      incidentId: { type: "string" },
      tool: { type: "string", enum: GATED_TOOL_ENUM },
      args: { type: "object", description: "Exact arguments the action will run with." },
      reason: { type: "string", description: "Why this action, in two or three sentences." },
      evidenceRefs: {
        type: "array",
        description: "Ids of the logs, traces, metric windows, and deployments supporting this proposal.",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["log", "trace", "metric_window", "deployment", "change"] },
            id: { type: "string" },
            label: { type: "string" },
          },
        },
      },
      expectedEffect: { type: "string", description: "What should change, and roughly how quickly." },
      notCovered: { type: "string", description: "What this action does NOT address." },
      risk: { type: "string", enum: ["low", "medium", "high"] },
    },
    required: ["incidentId", "tool", "args", "reason", "evidenceRefs", "expectedEffect", "notCovered", "risk"],
  },
  annotations: { readOnlyHint: false },
  execute: async (input: Record<string, unknown>) => {
    const r = await apiPost<{ approvalId: string; status: string }>("/api/approvals", input);
    return toolResult(`${r.approvalId} — ${r.status}. Awaiting human authorization in the console; do not poll aggressively.`);
  },
};

/**
 * Registered deliberately — its denial is the point (plan §6.7, §12.3). The
 * only path to a valid `approvalToken` is `GET /api/approvals/:id/nonce`,
 * which is never registered as a tool and only ever called by the console's
 * own Approve/Reject buttons after a trusted click. An agent calling this
 * has no way to supply a token that will validate, so it is always denied
 * and the attempt is recorded in the audit log.
 */
export const recordApproval = {
  name: "record_approval",
  description:
    "Records a human authorization decision. Requires an approval token that can only be produced " +
    "by a human action in the console, so an agent calling this will be denied and the attempt " +
    "recorded in the audit log.",
  inputSchema: {
    type: "object",
    properties: {
      approvalId: { type: "string" },
      decision: { type: "string", enum: ["approved", "rejected"] },
      approvalToken: { type: "string" },
    },
    required: ["approvalId", "decision", "approvalToken"],
  },
  annotations: { readOnlyHint: false },
  execute: async (input: Record<string, unknown>) => {
    const r = await apiPost<{ ok: boolean; status: string }>(`/api/approvals/${encodeURIComponent(String(input.approvalId))}/decide`, input);
    return toolResult(`${input.approvalId}: ${r.status}.`);
  },
};
