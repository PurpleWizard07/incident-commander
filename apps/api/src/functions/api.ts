import type { Config } from "@netlify/functions";
import { loadSession, withSession } from "../store/session.js";
import { consumeApprovalToken } from "../authz/approvalToken.js";

import * as incidents from "../routes/incidents.js";
import * as services from "../routes/services.js";
import * as deployments from "../routes/deployments.js";
import * as changes from "../routes/changes.js";
import * as observability from "../routes/observability.js";
import * as alertsRoute from "../routes/alerts.js";
import * as runbooks from "../routes/runbooks.js";
import * as actions from "../routes/actions.js";
import * as approvals from "../routes/approvals.js";
import * as auditRoute from "../routes/audit.js";
import * as stateRoute from "../routes/state.js";
import * as sessionRoute from "../routes/session.js";
import * as sim from "../routes/sim.js";

const DEFAULT_SESSION_ID = "anonymous"; // curl convenience; the real console always sends X-Session-Id

type ApiResult = { status: number; body: unknown };

function json({ status, body }: ApiResult): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function sessionIdFrom(req: Request): string {
  return req.headers.get("x-session-id") || DEFAULT_SESSION_ID;
}

function match(pattern: string, path: string): Record<string, string> | null {
  const patternSegs = pattern.split("/").filter(Boolean);
  const pathSegs = path.split("/").filter(Boolean);
  if (patternSegs.length !== pathSegs.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternSegs.length; i++) {
    const p = patternSegs[i];
    const v = pathSegs[i];
    if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(v);
    else if (p !== v) return null;
  }
  return params;
}

function csv(value: string | null): string[] | null {
  return value ? value.split(",").map((s) => s.trim()).filter(Boolean) : null;
}

export default async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;
  const q = url.searchParams;
  const sessionId = sessionIdFrom(req);

  let body: Record<string, unknown> = {};
  if (method === "POST") {
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      body = {};
    }
  }

  try {
    // ---- Read-only endpoints ------------------------------------------------
    if (method === "GET") {
      let params: Record<string, string> | null;

      if (path === "/api/incidents") {
        const session = await loadSession(sessionId);
        return json(incidents.getActiveIncidents(session, q.get("severity")));
      }
      if ((params = match("/api/incidents/:id/timeline", path))) {
        const session = await loadSession(sessionId);
        return json(incidents.getIncidentTimeline(session, params.id, q.get("sinceMinute")));
      }
      if ((params = match("/api/incidents/:id", path))) {
        const session = await loadSession(sessionId);
        return json(incidents.getIncident(session, params.id));
      }
      if ((params = match("/api/services/:id/health", path))) {
        const session = await loadSession(sessionId);
        return json(services.getServiceHealth(session, params.id));
      }
      if ((params = match("/api/services/:id/dependencies", path))) {
        const session = await loadSession(sessionId);
        return json(services.getServiceDependencies(session, params.id, q.get("direction")));
      }
      if (path === "/api/deployments") {
        const session = await loadSession(sessionId);
        return json(deployments.getRecentDeployments(session, q.get("service"), q.get("withinMinutes")));
      }
      if (path === "/api/changes") {
        const session = await loadSession(sessionId);
        return json(changes.getRecentChanges(session, q.get("service"), q.get("withinMinutes"), q.get("type")));
      }
      if (path === "/api/logs") {
        const session = await loadSession(sessionId);
        return json(
          observability.queryLogs(session, {
            service: q.get("service"),
            level: q.get("level"),
            contains: q.get("contains"),
            fromMinute: q.get("fromMinute"),
            toMinute: q.get("toMinute"),
            limit: q.get("limit"),
          })
        );
      }
      if (path === "/api/traces") {
        const session = await loadSession(sessionId);
        return json(observability.searchTraces(session, { service: q.get("service"), status: q.get("status"), limit: q.get("limit") }));
      }
      if (path === "/api/metrics/compare") {
        const session = await loadSession(sessionId);
        return json(
          observability.compareMetrics(session, {
            services: csv(q.get("services")),
            metrics: csv(q.get("metrics")),
            fromMinute: q.get("fromMinute"),
            toMinute: q.get("toMinute"),
          })
        );
      }
      if ((params = match("/api/alerts/:id", path))) {
        const session = await loadSession(sessionId);
        return json(alertsRoute.inspectAlert(session, params.id));
      }
      if (path === "/api/runbooks") {
        const session = await loadSession(sessionId);
        return json(runbooks.getRunbook(session, q.get("symptom"), q.get("service"), q.get("runbookId")));
      }
      if (path === "/api/approvals") {
        const session = await loadSession(sessionId);
        return json(approvals.getPendingApprovals(session, q.get("incidentId")));
      }
      if ((params = match("/api/approvals/:id/nonce", path))) {
        const session = await loadSession(sessionId);
        return json(await approvals.issueNonceForApproval(session, params.id));
      }
      if (path === "/api/audit") {
        const session = await loadSession(sessionId);
        return json(auditRoute.getAudit(session));
      }
      if (path === "/api/state") {
        const session = await loadSession(sessionId);
        return json(stateRoute.getState(session, q.get("since")));
      }
    }

    // ---- Mutating endpoints --------------------------------------------------
    if (method === "POST") {
      let params: Record<string, string> | null;

      if (path === "/api/incidents") {
        const result = await withSession(sessionId, (s) => {
          const { session, response } = incidents.createIncident(s, body);
          return { next: session, result: response };
        });
        return json(result);
      }
      if ((params = match("/api/incidents/:id/assign", path))) {
        const result = await withSession(sessionId, (s) => {
          const { session, response } = incidents.assignIncident(s, { ...body, incidentId: params!.id });
          return { next: session, result: response };
        });
        return json(result);
      }
      if ((params = match("/api/incidents/:id/notes", path))) {
        const result = await withSession(sessionId, (s) => {
          const { session, response } = incidents.addIncidentNote(s, { ...body, incidentId: params!.id });
          return { next: session, result: response };
        });
        return json(result);
      }
      if ((params = match("/api/incidents/:id/resolve", path))) {
        const result = await withSession(sessionId, (s) => {
          const { session, response } = incidents.resolveIncident(s, { ...body, incidentId: params!.id });
          return { next: session, result: response };
        });
        return json(result);
      }
      if (path === "/api/actions/rollback") {
        const result = await withSession(sessionId, (s) => {
          const { session, response } = actions.rollbackDeployment(s, body as never);
          return { next: session, result: response };
        });
        return json(result);
      }
      if (path === "/api/actions/restart") {
        const result = await withSession(sessionId, (s) => {
          const { session, response } = actions.restartService(s, body as never);
          return { next: session, result: response };
        });
        return json(result);
      }
      if (path === "/api/actions/scale") {
        const result = await withSession(sessionId, (s) => {
          const { session, response } = actions.scaleService(s, body as never);
          return { next: session, result: response };
        });
        return json(result);
      }
      if (path === "/api/actions/flag") {
        const result = await withSession(sessionId, (s) => {
          const { session, response } = actions.disableFeatureFlag(s, body as never);
          return { next: session, result: response };
        });
        return json(result);
      }
      if (path === "/api/approvals") {
        const result = await withSession(sessionId, (s) => {
          const { session, response } = approvals.requestApproval(s, body);
          return { next: session, result: response };
        });
        return json(result);
      }
      if ((params = match("/api/approvals/:id/decide", path))) {
        const approvalId = params.id;
        // Token consumption is async (a separate Blobs store — see
        // authz/approvalToken.ts) and must happen BEFORE the pure,
        // possibly-retried mutation step. See approvals.ts's
        // applyApprovalDecision doc comment for why reusing this same
        // already-computed boolean across any retry is still correct.
        const tokenValid = await consumeApprovalToken(body.approvalToken as string | undefined, approvalId, sessionId);
        const result = await withSession(sessionId, (s) => {
          const { session, response } = approvals.applyApprovalDecision(s, { ...body, approvalId } as never, tokenValid);
          return { next: session, result: response };
        });
        return json(result);
      }
      if (path === "/api/session") {
        const result = await withSession(sessionId, (s) => {
          const { session, response } = sessionRoute.setRole(s, body.role as string | undefined);
          return { next: session, result: response };
        });
        return json(result);
      }
      if (path === "/api/sim/scenario") {
        return json(await sim.loadScenario(sessionId, body.scenarioId as string | undefined, body.seed as string | undefined));
      }
      if (path === "/api/sim/reset") {
        const current = await loadSession(sessionId);
        return json(await sim.resetToSeed(sessionId, current.scenarioId, body.seed as string | undefined));
      }
    }

    return json({ status: 404, body: { error: `No route for ${method} ${path}.` } });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json({ status: 500, body: { error: message } });
  }
};

export const config: Config = {
  path: "/api/*",
};
