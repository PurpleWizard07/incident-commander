// Real HTTP calls against the deployed production API — the same endpoints
// apps/web/src/webmcp/tools/*.ts call. Kept as a small standalone module
// (no build step) so the eval runner and `invoke.mjs` can both `import` it
// directly with plain Node, no bundler involved. Plan §14.4 / §21.4.

const BASE_URL = process.env.IC_BASE_URL || "https://incident-commander-461.netlify.app";

async function apiGet(path, query, sessionId) {
  const url = new URL(path, BASE_URL);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers: { "X-Session-Id": sessionId } });
  return handle(res);
}

async function apiPost(path, body, sessionId) {
  const res = await fetch(new URL(path, BASE_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Session-Id": sessionId },
    body: JSON.stringify(body ?? {}),
  });
  return handle(res);
}

async function handle(res) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = json?.error ?? `Request failed with status ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return json;
}

const csv = (arr) => (arr ? arr.join(",") : undefined);

/** name -> (args, sessionId) => Promise<result>, mirroring apps/web/src/webmcp/tools/*.ts exactly. */
export const TOOLS = {
  get_active_incidents: (a, s) => apiGet("/api/incidents", { severity: a.severity }, s),
  get_incident: (a, s) => apiGet(`/api/incidents/${encodeURIComponent(a.incidentId)}`, {}, s),
  get_incident_timeline: (a, s) => apiGet(`/api/incidents/${encodeURIComponent(a.incidentId)}/timeline`, { sinceMinute: a.sinceMinute }, s),
  get_service_health: (a, s) => apiGet(`/api/services/${encodeURIComponent(a.service)}/health`, {}, s),
  get_service_dependencies: (a, s) => apiGet(`/api/services/${encodeURIComponent(a.service)}/dependencies`, { direction: a.direction }, s),
  get_recent_deployments: (a, s) => apiGet("/api/deployments", { service: a.service, withinMinutes: a.withinMinutes }, s),
  get_recent_changes: (a, s) => apiGet("/api/changes", { service: a.service, withinMinutes: a.withinMinutes, type: a.type }, s),
  query_logs: (a, s) => apiGet("/api/logs", { service: a.service, level: a.level, contains: a.contains, fromMinute: a.fromMinute, toMinute: a.toMinute, limit: a.limit ?? 50 }, s),
  search_traces: (a, s) => apiGet("/api/traces", { service: a.service, status: a.status, limit: a.limit ?? 20 }, s),
  compare_metrics: (a, s) => apiGet("/api/metrics/compare", { services: csv(a.services), metrics: csv(a.metrics), fromMinute: a.fromMinute, toMinute: a.toMinute }, s),
  inspect_alert: (a, s) => apiGet(`/api/alerts/${encodeURIComponent(a.alertId)}`, {}, s),
  get_runbook: (a, s) => apiGet("/api/runbooks", { symptom: a.symptom, service: a.service, runbookId: a.runbookId }, s),
  assign_incident: (a, s) => apiPost(`/api/incidents/${encodeURIComponent(a.incidentId)}/assign`, { assignee: a.assignee, actorKind: "agent" }, s),
  add_incident_note: (a, s) => apiPost(`/api/incidents/${encodeURIComponent(a.incidentId)}/notes`, { note: a.note, evidenceRefs: a.evidenceRefs, actorKind: "agent" }, s),
  resolve_incident: (a, s) => apiPost(`/api/incidents/${encodeURIComponent(a.incidentId)}/resolve`, { resolutionSummary: a.resolutionSummary, rootCause: a.rootCause, actorKind: "agent" }, s),
  create_incident: (a, s) => apiPost("/api/incidents", { title: a.title, severity: a.severity, affectedServices: a.affectedServices, description: a.description, actorKind: "agent" }, s),
  rollback_deployment: (a, s) => apiPost("/api/actions/rollback", a, s),
  restart_service: (a, s) => apiPost("/api/actions/restart", a, s),
  scale_service: (a, s) => apiPost("/api/actions/scale", a, s),
  disable_feature_flag: (a, s) => apiPost("/api/actions/flag", a, s),
  get_pending_approvals: (a, s) => apiGet("/api/approvals", { incidentId: a.incidentId }, s),
  request_approval: (a, s) => apiPost("/api/approvals", a, s),
  // record_approval is deliberately NOT reachable here with a valid token — see plan §12.3.
  // An eval agent calling it should always be denied, same as a real agent would be.
  record_approval: (a, s) => apiPost(`/api/approvals/${encodeURIComponent(a.approvalId)}/decide`, a, s),
};

export async function callTool(name, args, sessionId) {
  const fn = TOOLS[name];
  if (!fn) throw new Error(`Unknown tool "${name}"`);
  return fn(args ?? {}, sessionId);
}

export async function loadScenario(scenarioId, seed, sessionId) {
  return apiPost("/api/sim/scenario", { scenarioId, seed }, sessionId);
}
