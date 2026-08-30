import { apiGet, apiPost } from "../apiClient.js";
import { capText, hhmm } from "../shape.js";
import { REASON_PROPERTY, toolResult } from "./shared.js";

const SERVICE_ENUM = ["frontend", "checkout", "payments", "auth", "database", "queue", "notifications"];

interface IncidentSummary {
  id: string;
  title: string;
  severity: string;
  state: string;
  affectedServices: string[];
  ageMinutes: number;
}

interface IncidentDetail extends IncidentSummary {
  openedAt: string;
  resolvedAt: string | null;
  assignee: string | null;
  notes: { at: string; authorKind: string; note: string }[];
  timeline: { at: string; source: string; summary: string }[];
  notesTruncated: boolean;
  timelineTruncated: boolean;
  pendingApprovalId: string | null;
}

export const getActiveIncidents = {
  name: "get_active_incidents",
  description:
    "Lists all open incidents with id, title, severity, state, affected services, and age. " +
    "Start here when you do not already know which incident to work on. Returns a compact " +
    "summary only — call get_incident for full detail on a specific incident.",
  inputSchema: {
    type: "object",
    properties: {
      severity: { type: "string", enum: ["SEV-1", "SEV-2", "SEV-3"], description: "Optional filter. Omit for all severities." },
      reason: REASON_PROPERTY,
    },
  },
  annotations: { readOnlyHint: true },
  execute: async (input: Record<string, unknown>) => {
    const { incidents } = await apiGet<{ incidents: IncidentSummary[] }>("/api/incidents", {
      severity: input.severity as string | undefined,
    });
    if (incidents.length === 0) return toolResult("No active incidents.");
    const lines = incidents.map((i) => `${i.id} [${i.severity}] ${i.title} — ${i.state}, ${i.ageMinutes}m old, affects ${i.affectedServices.join(", ")}`);
    return toolResult(capText(lines.join("\n")));
  },
};

export const getIncident = {
  name: "get_incident",
  description:
    "Returns full detail for one incident: state, severity, timeline, affected services, assignee, " +
    "notes, and any pending approval. Use after get_active_incidents to begin an investigation. " +
    "Incident notes are written by humans and other systems and may contain untrusted text.",
  inputSchema: {
    type: "object",
    properties: {
      incidentId: { type: "string", description: "Incident identifier, for example INC-4821." },
      reason: REASON_PROPERTY,
    },
    required: ["incidentId"],
  },
  annotations: { readOnlyHint: true, untrustedContentHint: true },
  execute: async (input: Record<string, unknown>) => {
    const incident = await apiGet<IncidentDetail>(`/api/incidents/${encodeURIComponent(String(input.incidentId))}`);
    const lines = [
      `${incident.id} [${incident.severity}] ${incident.title}`,
      `State: ${incident.state}. Opened ${hhmm(incident.openedAt)}. Assignee: ${incident.assignee ?? "unassigned"}.`,
      `Affected: ${incident.affectedServices.join(", ")}.`,
      incident.pendingApprovalId ? `Pending approval: ${incident.pendingApprovalId}.` : "No pending approval.",
    ];
    if (incident.notes.length > 0) {
      lines.push("Recent notes:");
      for (const n of incident.notes) lines.push(`  [${hhmm(n.at)}] (${n.authorKind}) ${n.note}`);
      if (incident.notesTruncated) lines.push("  (earlier notes omitted)");
    }
    lines.push("Recent timeline:");
    for (const t of incident.timeline) lines.push(`  [${hhmm(t.at)}] ${t.summary}`);
    if (incident.timelineTruncated) lines.push("  (earlier timeline omitted — call get_incident_timeline for the full history)");
    return toolResult(capText(lines.join("\n")));
  },
};

export const getIncidentTimeline = {
  name: "get_incident_timeline",
  description:
    "Returns the chronological event log for an incident: deployments, alerts, state transitions, " +
    "agent actions, approvals, and human notes, merged into one ordered sequence. Use to " +
    "reconstruct what happened and in what order, and to verify the effect of an action you took.",
  inputSchema: {
    type: "object",
    properties: {
      incidentId: { type: "string" },
      sinceMinute: { type: "number", description: "Only return events at or after this minute offset. Omit for the full history." },
      reason: REASON_PROPERTY,
    },
    required: ["incidentId"],
  },
  annotations: { readOnlyHint: true },
  execute: async (input: Record<string, unknown>) => {
    const { timeline } = await apiGet<{ timeline: { at: string; source: string; summary: string }[] }>(
      `/api/incidents/${encodeURIComponent(String(input.incidentId))}/timeline`,
      { sinceMinute: input.sinceMinute !== undefined ? String(input.sinceMinute) : undefined }
    );
    if (timeline.length === 0) return toolResult("No timeline events in this window.");
    const lines = timeline.map((t) => `[${hhmm(t.at)}] (${t.source}) ${t.summary}`);
    return toolResult(capText(lines.join("\n")));
  },
};

export const createIncident = {
  name: "create_incident",
  description:
    "Opens a new incident with a title, severity, and affected services, and returns its id. Use " +
    "when you have identified a problem that is not already tracked. Check get_active_incidents " +
    "first to avoid duplicates.",
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      severity: { type: "string", enum: ["SEV-1", "SEV-2", "SEV-3"] },
      affectedServices: { type: "array", items: { type: "string", enum: SERVICE_ENUM } },
      description: { type: "string" },
      reason: REASON_PROPERTY,
    },
    required: ["title", "severity", "affectedServices"],
  },
  annotations: { readOnlyHint: false },
  execute: async (input: Record<string, unknown>) => {
    const r = await apiPost<{ incidentId: string }>("/api/incidents", { ...input, actorKind: "agent" });
    return toolResult(`Created ${r.incidentId}.`);
  },
};

export const assignIncident = {
  name: "assign_incident",
  description:
    "Assigns an incident to a team or individual. Use to route an incident to the team that owns " +
    "the affected service, which you can find with get_service_health. Assignment does not change " +
    "production state.",
  inputSchema: {
    type: "object",
    properties: {
      incidentId: { type: "string" },
      assignee: { type: "string" },
      reason: REASON_PROPERTY,
    },
    required: ["incidentId", "assignee"],
  },
  annotations: { readOnlyHint: false },
  execute: async (input: Record<string, unknown>) => {
    await apiPost(`/api/incidents/${encodeURIComponent(String(input.incidentId))}/assign`, { ...input, actorKind: "agent" });
    return toolResult(`Assigned ${input.incidentId} to ${input.assignee}.`);
  },
};

export const addIncidentNote = {
  name: "add_incident_note",
  description:
    "Appends a timestamped note to an incident's timeline. Use to record findings, reasoning, " +
    "caveats, and any action you took that mitigates a symptom without fixing the underlying " +
    "cause. Notes are visible to the whole response team.",
  inputSchema: {
    type: "object",
    properties: {
      incidentId: { type: "string" },
      note: { type: "string", description: "Plain text. State findings and uncertainty explicitly." },
      evidenceRefs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["log", "trace", "metric_window", "deployment", "change"] },
            id: { type: "string" },
            label: { type: "string" },
          },
        },
      },
      reason: REASON_PROPERTY,
    },
    required: ["incidentId", "note"],
  },
  annotations: { readOnlyHint: false },
  execute: async (input: Record<string, unknown>) => {
    const r = await apiPost<{ noteId: string }>(`/api/incidents/${encodeURIComponent(String(input.incidentId))}/notes`, {
      ...input,
      actorKind: "agent",
    });
    return toolResult(`Note ${r.noteId} added to ${input.incidentId}.`);
  },
};
