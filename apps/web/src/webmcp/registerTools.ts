import { getActiveIncidents, getIncident, getIncidentTimeline } from "./tools/incidents.js";
import { getServiceHealth, getServiceDependencies } from "./tools/services.js";
import { getRecentDeployments, getRecentChanges } from "./tools/deploymentsAndChanges.js";
import { queryLogs, searchTraces, compareMetrics } from "./tools/observability.js";
import { inspectAlert, getRunbook } from "./tools/alertsAndRunbooks.js";

export type ToolCallLogEntry = {
  id: string;
  at: string;
  tool: string;
  args: unknown;
  result: unknown;
  error?: string;
};

type Listener = (entry: ToolCallLogEntry) => void;

const listeners = new Set<Listener>();

export function onToolCall(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(entry: ToolCallLogEntry) {
  for (const l of listeners) l(entry);
}

const INVESTIGATION_TOOLS = [
  getActiveIncidents,
  getIncident,
  getIncidentTimeline,
  getServiceHealth,
  getServiceDependencies,
  getRecentDeployments,
  getRecentChanges,
  queryLogs,
  searchTraces,
  compareMetrics,
  inspectAlert,
  getRunbook,
];

/**
 * Phase 3: the 12 read-only investigation tools from plan §6.3, registered
 * imperatively via document.modelContext.registerTool(). Action and approval
 * tools are Phase 6/7 — this is deliberately investigation-only so far.
 */
export function registerInvestigationTools(): () => void {
  if (typeof document === "undefined" || !document.modelContext) {
    console.warn(
      "[webmcp] document.modelContext is not available in this browser. " +
        "Enable chrome://flags/#enable-webmcp-testing, or open this page in ChatGPT's in-app browser."
    );
    return () => {};
  }

  const controller = new AbortController();

  for (const tool of INVESTIGATION_TOOLS) {
    document.modelContext.registerTool(
      {
        ...tool,
        execute: async (input: Record<string, unknown>) => {
          const id = crypto.randomUUID();
          const at = new Date().toISOString();
          try {
            const result = await tool.execute(input);
            emit({ id, at, tool: tool.name, args: input, result });
            return result;
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            emit({ id, at, tool: tool.name, args: input, result: null, error: message });
            throw err;
          }
        },
      },
      { signal: controller.signal }
    );
  }

  return () => controller.abort();
}
