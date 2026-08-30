import { getActiveIncidents, getIncident, getIncidentTimeline, createIncident, assignIncident, addIncidentNote } from "./tools/incidents.js";
import { getServiceHealth, getServiceDependencies } from "./tools/services.js";
import { getRecentDeployments, getRecentChanges } from "./tools/deploymentsAndChanges.js";
import { queryLogs, searchTraces, compareMetrics } from "./tools/observability.js";
import { inspectAlert, getRunbook } from "./tools/alertsAndRunbooks.js";
import { rollbackDeployment, restartService, scaleService, disableFeatureFlag, resolveIncident } from "./tools/actions.js";
import { getPendingApprovals, requestApproval, recordApproval } from "./tools/approvals.js";

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

/** Plan §6.4 action tools (8) — `create_incident`/`assign_incident`/`add_incident_note` are non-gated; the other five are gated or state-gated, enforced server-side. */
const ACTION_TOOLS = [
  createIncident,
  assignIncident,
  addIncidentNote,
  rollbackDeployment,
  restartService,
  scaleService,
  disableFeatureFlag,
  resolveIncident,
];

/** Plan §6.5 human-control tools (3). `record_approval`'s denial is deliberate — see that tool's own doc comment. */
const APPROVAL_TOOLS = [getPendingApprovals, requestApproval, recordApproval];

/** All 23 imperative tools (plan §0/§6) — the 2 declarative forms are Phase 7. */
const ALL_TOOLS = [...INVESTIGATION_TOOLS, ...ACTION_TOOLS, ...APPROVAL_TOOLS];

/** Wraps a tool's `execute` with the start/settle instrumentation above — shared by the real WebMCP registration and `testInvokeTool` below, so a manual test call exercises the identical code path a live agent's call would. */
function instrument(tool: (typeof ALL_TOOLS)[number]) {
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

export interface ToolSurfaceContext {
  /** null = no incident selected (there's always exactly one in this build, but the mechanism supports the general case). */
  incidentId: string | null;
  role: string;
  incidentState: string | null;
  hasPendingApproval: boolean;
}

/**
 * The variation table from plan §8.1, as one pure function so both
 * registration and the rail's "current tool surface" readout derive from
 * the same source instead of two copies of the same conditions drifting
 * apart. We unregister for AUTHORITY (observer, no incident selected, or an
 * already-RESOLVED incident for its remediation tools) and never for
 * feasibility — a tool that could fail right now (e.g. `rollback_deployment`
 * when a service has no rollback target) still registers and fails loudly
 * with an explanatory error instead of silently vanishing (plan §8.1's
 * closing paragraph).
 *
 * `create_incident` and `add_incident_note` are deliberately absent: they're
 * declarative-only now (plan §21.3's forms in DeclarativeForms.tsx). Chrome's
 * real WebMCP implementation throws `InvalidStateError: Duplicate tool name`
 * if the same name is registered both declaratively (the `<form toolname>`
 * parses on mount, before this effect ever runs) and imperatively — confirmed
 * empirically, not a hypothetical. See phase-summary.md's Phase 7 decisions.
 */
export function selectRegisteredTools(ctx: ToolSurfaceContext) {
  const tools: (typeof ALL_TOOLS)[number][] = [...INVESTIGATION_TOOLS];
  if (ctx.role === "observer") return tools;

  if (ctx.incidentId === null) return tools;

  if (ctx.incidentState !== "RESOLVED") {
    tools.push(assignIncident, resolveIncident, rollbackDeployment, restartService, scaleService, disableFeatureFlag);
  }
  tools.push(getPendingApprovals, requestApproval);
  if (ctx.hasPendingApproval) tools.push(recordApproval);
  return tools;
}

/**
 * Breakdown for the activity rail's "current tool surface" readout (plan
 * §8.2). `declarative` isn't derived from `selectRegisteredTools` — those
 * two tools are never in that list (see above) — it mirrors the same
 * visibility condition `IncidentWorkspace` uses to render (or not render)
 * the `<form toolname>` elements, since that's the only way a declarative
 * tool actually appears or disappears.
 */
export function describeToolSurface(ctx: ToolSurfaceContext): { read: number; action: number; approval: number; declarative: number } {
  const tools = selectRegisteredTools(ctx);
  return {
    read: tools.filter((t) => (INVESTIGATION_TOOLS as unknown[]).includes(t)).length,
    action: tools.filter((t) => (ACTION_TOOLS as unknown[]).includes(t)).length,
    approval: tools.filter((t) => (APPROVAL_TOOLS as unknown[]).includes(t)).length,
    declarative: ctx.role !== "observer" && ctx.incidentId !== null ? 2 : 0,
  };
}

/**
 * Registers whichever tools `selectRegisteredTools` says belong to the
 * current context, via document.modelContext.registerTool(). Callers
 * (AppShell) create one AbortController-backed "generation" per distinct
 * `(incidentId, role, incidentState, hasPendingApproval)` combination — see
 * plan §8.2 — tearing the previous generation down (which fires `toolchange`
 * natively) before building the next. Authorization for the gated/
 * state-gated tools is enforced server-side regardless of what's registered
 * client-side (plan §12.1: "WebMCP is the agent interface, not the security
 * boundary").
 */
export function registerDynamicTools(ctx: ToolSurfaceContext): () => void {
  if (typeof document === "undefined" || !document.modelContext) {
    console.warn(
      "[webmcp] document.modelContext is not available in this browser. " +
        "Enable chrome://flags/#enable-webmcp-testing, or open this page in ChatGPT's in-app browser."
    );
    return () => {};
  }

  const controller = new AbortController();

  for (const tool of selectRegisteredTools(ctx)) {
    // registerTool() returns a Promise that can reject (e.g. a name collision
    // with a declarative form) — always handled, never left as an unhandled
    // rejection, regardless of what causes a given registration to fail.
    document.modelContext.registerTool({ ...tool, execute: instrument(tool) }, { signal: controller.signal }).catch((err) => {
      console.warn(`[webmcp] failed to register tool "${tool.name}":`, err);
    });
  }

  return () => controller.abort();
}

/**
 * Manual test hook, same spirit as Phase 0/3's manual test buttons: calls a
 * tool by name through the exact same instrumented path a live agent's call
 * takes (start/settle events, reason capture), for verifying the reactivity
 * contract without needing an LLM in the loop. Harmless to leave registered
 * — it can only call the same 23 tools any agent already can, all subject
 * to the same server-side authorization, and does nothing unless invoked
 * from the browser console.
 */
export function testInvokeTool(name: string, input: Record<string, unknown> = {}): Promise<unknown> {
  const tool = ALL_TOOLS.find((t) => t.name === name);
  if (!tool) return Promise.reject(new Error(`No tool named "${name}".`));
  return instrument(tool)(input);
}

if (typeof window !== "undefined") {
  (window as unknown as { icTestInvoke: typeof testInvokeTool }).icTestInvoke = testInvokeTool;
}
