import type { Severity, EvidenceRef, IncidentNote, TimelineEvent } from "../sharedTypes.js";
import { isoForMinute } from "../simEngine.js";
import type { SessionState } from "../store/session.js";
import { appendAudit } from "../audit/log.js";
import { canMutate } from "../authz/roles.js";

export function getActiveIncidents(session: SessionState, severity: string | null) {
  let incidents = session.incidents.filter((i) => i.state !== "RESOLVED");
  if (severity) incidents = incidents.filter((i) => i.severity === severity);
  return {
    status: 200,
    body: {
      incidents: incidents.map((i) => ({
        id: i.id,
        title: i.title,
        severity: i.severity,
        state: i.state,
        affectedServices: i.affectedServices,
        ageMinutes: session.nowMinute - i.openedAtMinute,
      })),
    },
  };
}

export function getIncident(session: SessionState, incidentId: string) {
  const incident = session.incidents.find((i) => i.id === incidentId);
  if (!incident) return { status: 404, body: { error: `No incident "${incidentId}".` } };
  const pendingApproval = session.approvals.find((a) => a.incidentId === incidentId && a.status === "pending");
  return {
    status: 200,
    body: {
      ...incident,
      notes: incident.notes.slice(-5),
      timeline: incident.timeline.slice(-10),
      notesTruncated: incident.notes.length > 5,
      timelineTruncated: incident.timeline.length > 10,
      pendingApprovalId: pendingApproval?.id ?? null,
    },
  };
}

export function getIncidentTimeline(session: SessionState, incidentId: string, sinceMinute: string | null) {
  const incident = session.incidents.find((i) => i.id === incidentId);
  if (!incident) return { status: 404, body: { error: `No incident "${incidentId}".` } };
  const since = sinceMinute ? Number(sinceMinute) : 0;
  return { status: 200, body: { timeline: incident.timeline.filter((e) => e.atMinute >= since) } };
}

export function createIncident(
  session: SessionState,
  input: { title?: string; severity?: Severity; affectedServices?: string[]; description?: string; actorKind?: "agent" | "human" }
): { session: SessionState; response: { status: number; body: unknown } } {
  if (!canMutate(session.role)) {
    const next = appendAudit(session, { tool: "create_incident", args: input, outcome: "denied", denialReason: "Observer role cannot create incidents.", resultSummary: "denied" });
    return { session: next, response: { status: 403, body: { error: "Observer role cannot create incidents." } } };
  }
  if (!input.title || !input.severity || !input.affectedServices?.length) {
    return { session, response: { status: 400, body: { error: "title, severity, and affectedServices are required." } } };
  }

  const id = `INC-${Math.floor(1000 + Math.random() * 9000)}`;
  const timelineEntry: TimelineEvent = { atMinute: session.nowMinute, at: isoForMinute(session.nowMinute), source: input.actorKind === "human" ? "human" : "agent", summary: `${id} opened: ${input.title}` };
  const incident = {
    id,
    title: input.title,
    severity: input.severity,
    state: "OPEN" as const,
    openedAtMinute: session.nowMinute,
    openedAt: isoForMinute(session.nowMinute),
    resolvedAt: null,
    affectedServices: input.affectedServices as never[],
    assignee: null,
    notes: input.description ? [{ id: `note-${id}-0`, atMinute: session.nowMinute, at: isoForMinute(session.nowMinute), authorKind: (input.actorKind ?? "agent") as "agent" | "human", author: input.actorKind === "human" ? "console-user" : "agent", note: input.description, evidenceRefs: [] }] : [],
    timeline: [timelineEntry],
  };

  let next: SessionState = { ...session, incidents: [...session.incidents, incident] };
  next = appendAudit(next, { tool: "create_incident", args: input as Record<string, unknown>, outcome: "allowed", resultSummary: `Created ${id}`, actorKind: input.actorKind });
  return { session: next, response: { status: 200, body: { incidentId: id } } };
}

export function assignIncident(
  session: SessionState,
  input: { incidentId?: string; assignee?: string; actorKind?: "agent" | "human" }
): { session: SessionState; response: { status: number; body: unknown } } {
  if (!canMutate(session.role)) {
    return { session, response: { status: 403, body: { error: "Observer role cannot assign incidents." } } };
  }
  if (!input.incidentId || !input.assignee) {
    return { session, response: { status: 400, body: { error: "incidentId and assignee are required." } } };
  }
  const incident = session.incidents.find((i) => i.id === input.incidentId);
  if (!incident) return { session, response: { status: 404, body: { error: `No incident "${input.incidentId}".` } } };

  const updated = { ...incident, assignee: input.assignee, timeline: [...incident.timeline, { atMinute: session.nowMinute, at: isoForMinute(session.nowMinute), source: (input.actorKind ?? "agent") as "agent" | "human", summary: `Assigned to ${input.assignee}` }] };
  let next: SessionState = { ...session, incidents: session.incidents.map((i) => (i.id === updated.id ? updated : i)) };
  next = appendAudit(next, { tool: "assign_incident", args: input as Record<string, unknown>, outcome: "allowed", resultSummary: `Assigned ${input.incidentId} to ${input.assignee}`, actorKind: input.actorKind });
  return { session: next, response: { status: 200, body: { ok: true } } };
}

export function addIncidentNote(
  session: SessionState,
  input: { incidentId?: string; note?: string; evidenceRefs?: EvidenceRef[]; actorKind?: "agent" | "human" }
): { session: SessionState; response: { status: number; body: unknown } } {
  if (!canMutate(session.role)) {
    return { session, response: { status: 403, body: { error: "Observer role cannot add notes." } } };
  }
  if (!input.incidentId || !input.note) {
    return { session, response: { status: 400, body: { error: "incidentId and note are required." } } };
  }
  const incident = session.incidents.find((i) => i.id === input.incidentId);
  if (!incident) return { session, response: { status: 404, body: { error: `No incident "${input.incidentId}".` } } };

  const actorKind = input.actorKind ?? "agent";
  const entry: IncidentNote = { id: `note-${input.incidentId}-${incident.notes.length}`, atMinute: session.nowMinute, at: isoForMinute(session.nowMinute), authorKind: actorKind, author: actorKind === "human" ? "console-user" : "agent", note: input.note, evidenceRefs: input.evidenceRefs ?? [] };
  const updated = { ...incident, notes: [...incident.notes, entry], timeline: [...incident.timeline, { atMinute: session.nowMinute, at: isoForMinute(session.nowMinute), source: actorKind, summary: `Note added: ${input.note.slice(0, 80)}` }] };
  let next: SessionState = { ...session, incidents: session.incidents.map((i) => (i.id === updated.id ? updated : i)) };
  next = appendAudit(next, { tool: "add_incident_note", args: input as Record<string, unknown>, outcome: "allowed", resultSummary: `Note added to ${input.incidentId}`, actorKind });
  return { session: next, response: { status: 200, body: { noteId: entry.id } } };
}

export function resolveIncident(
  session: SessionState,
  input: { incidentId?: string; resolutionSummary?: string; rootCause?: string; actorKind?: "agent" | "human" }
): { session: SessionState; response: { status: number; body: unknown } } {
  if (!canMutate(session.role)) {
    return { session, response: { status: 403, body: { error: "Observer role cannot resolve incidents." } } };
  }
  if (!input.incidentId || !input.resolutionSummary || !input.rootCause) {
    return { session, response: { status: 400, body: { error: "incidentId, resolutionSummary, and rootCause are required." } } };
  }
  const incident = session.incidents.find((i) => i.id === input.incidentId);
  if (!incident) return { session, response: { status: 404, body: { error: `No incident "${input.incidentId}".` } } };

  if (incident.state !== "MONITORING") {
    const denialReason = `Cannot resolve ${incident.id}: incident is in ${incident.state}, not MONITORING. A remediation must be executed and verified with compare_metrics before resolving.`;
    const next = appendAudit(session, { tool: "resolve_incident", args: input as Record<string, unknown>, outcome: "denied", denialReason, resultSummary: "denied", actorKind: input.actorKind });
    return { session: next, response: { status: 409, body: { error: denialReason } } };
  }

  const updated = { ...incident, state: "RESOLVED" as const, resolvedAt: isoForMinute(session.nowMinute), timeline: [...incident.timeline, { atMinute: session.nowMinute, at: isoForMinute(session.nowMinute), source: (input.actorKind ?? "agent") as "agent" | "human", summary: `Resolved: ${input.resolutionSummary}` }] };
  let next: SessionState = { ...session, incidents: session.incidents.map((i) => (i.id === updated.id ? updated : i)) };
  next = appendAudit(next, { tool: "resolve_incident", args: input as Record<string, unknown>, outcome: "allowed", resultSummary: `Resolved ${input.incidentId}`, actorKind: input.actorKind });
  return { session: next, response: { status: 200, body: { ok: true } } };
}
