import { getActiveIncidents, getIncident, getIncidentTimeline } from "./tools/incidents.js";
import { getServiceHealth, getServiceDependencies } from "./tools/services.js";
import { getRecentDeployments, getRecentChanges } from "./tools/deploymentsAndChanges.js";
import { queryLogs, searchTraces, compareMetrics } from "./tools/observability.js";
import { inspectAlert, getRunbook } from "./tools/alertsAndRunbooks.js";

/**
 * One record per tool call, updated in place from `start` (settledAt: null)
 * to settled (settledAt: a timestamp) — rather than two separate events —
 * so consumers never have to correlate two messages by id themselves.
 * Feeds the Phase 5 reactivity contract (plan §9): the UI's pending vs.
 * settled treatment comes directly from `settledAt`, and `reason` (plan
 * §9.1) rides along on the same record the activity rail already renders.
 */
export interface ToolCallRecord {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  reason?: string;
  startedAt: number;
  settledAt: number | null;
  result?: unknown;
  error?: string;
}

type Listener = (records: ToolCallRecord[]) => void;

const listeners = new Set<Listener>();
const MAX_RECORDS = 50;
let records: ToolCallRecord[] = [];

/** Calls back immediately with the current snapshot, then on every change. */
export function onToolActivity(listener: Listener): () => void {
  listener(records);
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function upsert(record: ToolCallRecord) {
  const idx = records.findIndex((r) => r.id === record.id);
  records = idx === -1 ? [record, ...records].slice(0, MAX_RECORDS) : records.map((r) => (r.id === record.id ? record : r));
  for (const l of listeners) l(records);
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

/** Wraps a tool's `execute` with the start/settle instrumentation above — shared by the real WebMCP registration and `testInvokeTool` below, so a manual test call exercises the identical code path a live agent's call would. */
function instrument(tool: (typeof INVESTIGATION_TOOLS)[number]) {
  return async (input: Record<string, unknown>) => {
    const id = crypto.randomUUID();
    const startedAt = Date.now();
    const reason = typeof input.reason === "string" ? input.reason : undefined;
    upsert({ id, tool: tool.name, args: input, reason, startedAt, settledAt: null });
    try {
      const result = await tool.execute(input);
      upsert({ id, tool: tool.name, args: input, reason, startedAt, settledAt: Date.now(), result });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      upsert({ id, tool: tool.name, args: input, reason, startedAt, settledAt: Date.now(), error: message });
      throw err;
    }
  };
}

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
    document.modelContext.registerTool({ ...tool, execute: instrument(tool) }, { signal: controller.signal });
  }

  return () => controller.abort();
}

/**
 * Manual test hook, same spirit as Phase 0/3's manual test buttons: calls a
 * tool by name through the exact same instrumented path a live agent's call
 * takes (start/settle events, reason capture), for verifying the Phase 5
 * reactivity contract without needing an LLM in the loop. Harmless to leave
 * registered — it can only call the same 12 read-only, server-authorized
 * tools any agent already can, and does nothing unless invoked from the
 * browser console.
 */
export function testInvokeTool(name: string, input: Record<string, unknown> = {}): Promise<unknown> {
  const tool = INVESTIGATION_TOOLS.find((t) => t.name === name);
  if (!tool) return Promise.reject(new Error(`No investigation tool named "${name}".`));
  return instrument(tool)(input);
}

if (typeof window !== "undefined") {
  (window as unknown as { icTestInvoke: typeof testInvokeTool }).icTestInvoke = testInvokeTool;
}
