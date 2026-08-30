import { apiGet } from "../apiClient.js";
import { capText } from "../shape.js";
import { REASON_PROPERTY, toolResult } from "./shared.js";

interface Alert {
  id: string;
  name: string;
  service: string;
  metric: string;
  threshold: number;
  comparator: string;
  firedAt: string;
  severity: string;
  currentValue: number;
  incidentId: string | null;
}

interface RunbookStep {
  n: number;
  text: string;
  toolHint: string | null;
}

interface Runbook {
  id: string;
  title: string;
  steps: RunbookStep[];
}

export const inspectAlert = {
  name: "inspect_alert",
  description:
    "Returns the definition and firing details of an alert: metric, threshold, comparator, " +
    "severity, when it fired, current value, and the linked incident. Use to understand exactly " +
    "what condition triggered a page, which is often narrower than the incident itself.",
  inputSchema: {
    type: "object",
    properties: {
      alertId: { type: "string" },
      reason: REASON_PROPERTY,
    },
    required: ["alertId"],
  },
  annotations: { readOnlyHint: true },
  execute: async (input: Record<string, unknown>) => {
    const { alert } = await apiGet<{ alert: Alert }>(`/api/alerts/${encodeURIComponent(String(input.alertId))}`);
    const text =
      `${alert.name} (${alert.id}, ${alert.severity}): fired at ${alert.firedAt.slice(11, 16)} because ` +
      `${alert.service}.${alert.metric} ${alert.comparator} ${alert.threshold} (current value ${alert.currentValue}). ` +
      `Linked incident: ${alert.incidentId ?? "none"}.`;
    return toolResult(capText(text));
  },
};

export const getRunbook = {
  name: "get_runbook",
  description:
    "Retrieves the operational runbook matching a symptom or service, with numbered steps. Some " +
    "steps name a specific tool to use. Consult a runbook before proposing remediation, especially " +
    "when the cause may lie outside systems you control.",
  inputSchema: {
    type: "object",
    properties: {
      symptom: { type: "string", description: 'Free-text symptom, e.g. "database pool saturation".' },
      service: { type: "string" },
      runbookId: { type: "string" },
      reason: REASON_PROPERTY,
    },
  },
  annotations: { readOnlyHint: true },
  execute: async (input: Record<string, unknown>) => {
    const r = await apiGet<{ runbook?: Runbook; runbooks?: Runbook[]; note?: string }>("/api/runbooks", {
      symptom: input.symptom as string | undefined,
      service: input.service as string | undefined,
      runbookId: input.runbookId as string | undefined,
    });
    if (r.runbook) {
      const lines = [`${r.runbook.title} (${r.runbook.id})`, ...r.runbook.steps.map((s) => `  ${s.n}. ${s.text}${s.toolHint ? ` [tool: ${s.toolHint}]` : ""}`)];
      return toolResult(capText(lines.join("\n")));
    }
    return toolResult(r.note ?? "No matching runbook found.");
  },
};
