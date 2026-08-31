import { useEffect, useState } from "react";
import { SERVICES, SERVICE_IDS } from "@incident-commander/shared";
import type { ServiceId, Deployment, Alert, Runbook, AuditRecord } from "@incident-commander/shared";
import { Panel } from "./Skeleton.js";
import { statusColor, statusLabel } from "./statusColors.js";
import { getAllAlerts, getAllRunbooks, getAudit, type ServiceHealthSummary } from "./api.js";

const ALL_TOOL_NAMES = new Set([
  "get_active_incidents", "get_incident", "get_incident_timeline", "get_service_health",
  "get_service_dependencies", "get_recent_deployments", "get_recent_changes", "query_logs",
  "search_traces", "compare_metrics", "inspect_alert", "get_runbook",
  "assign_incident", "resolve_incident", "rollback_deployment", "restart_service",
  "scale_service", "disable_feature_flag", "get_pending_approvals", "request_approval",
  "record_approval", "create_incident", "add_incident_note",
]);

/** A runbook's `toolHint` should always name a real tool (plan §9 Phase 9 exit criterion) — styled distinctly if it somehow doesn't, rather than silently rendered as if it were fine. */
function ToolHintChip({ tool }: { tool: string }) {
  const known = ALL_TOOL_NAMES.has(tool);
  return (
    <span
      className="rounded px-1 font-mono text-[10px]"
      style={{ background: known ? "var(--color-ic-panel-2)" : "var(--color-ic-down)", color: known ? "var(--color-ic-accent)" : "var(--color-ic-bg)" }}
      title={known ? "Resolves to a registered tool" : "Does not match any registered tool"}
    >
      {tool}
    </span>
  );
}

export function ServicesPage({ serviceHealth }: { serviceHealth: Partial<Record<ServiceId, ServiceHealthSummary>> }) {
  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <Panel title="SERVICES" className="flex-1">
        <div className="h-full overflow-y-auto font-mono text-[11px]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ic-border text-ic-text-dim">
                <th className="px-2 py-1.5 text-left">Service</th>
                <th className="px-2 py-1.5 text-left">Tier</th>
                <th className="px-2 py-1.5 text-left">Status</th>
                <th className="px-2 py-1.5 text-left">Error rate</th>
                <th className="px-2 py-1.5 text-left">Latency p95</th>
                <th className="px-2 py-1.5 text-left">Instances</th>
                <th className="px-2 py-1.5 text-left">Owner</th>
                <th className="px-2 py-1.5 text-left">Depends on</th>
              </tr>
            </thead>
            <tbody>
              {SERVICE_IDS.map((id) => {
                const h = serviceHealth[id];
                const s = SERVICES[id];
                return (
                  <tr key={id} className="border-b border-ic-border">
                    <td className="px-2 py-1 text-ic-text">{s.displayName}</td>
                    <td className="px-2 py-1 text-ic-text-dim">{s.tier}</td>
                    <td className="px-2 py-1" style={{ color: statusColor(h?.status) }}>
                      {statusLabel(h?.status)}
                    </td>
                    <td className="px-2 py-1 text-ic-text-dim">{h ? `${(h.errorRate * 100).toFixed(2)}%` : "—"}</td>
                    <td className="px-2 py-1 text-ic-text-dim">{h?.latencyP95Ms != null ? `${h.latencyP95Ms.toFixed(0)}ms` : "—"}</td>
                    <td className="px-2 py-1 text-ic-text-dim">{s.instances}</td>
                    <td className="px-2 py-1 text-ic-text-dim">{s.owner}</td>
                    <td className="px-2 py-1 text-ic-text-dim">{s.dependsOn.join(", ") || "none"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

export function DeploymentsPage({ deployments }: { deployments: Deployment[] }) {
  const sorted = [...deployments].sort((a, b) => b.deployedAtMinute - a.deployedAtMinute);
  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <Panel title="DEPLOYMENTS" className="flex-1">
        <div className="h-full overflow-y-auto font-mono text-[11px]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-ic-border text-ic-text-dim">
                <th className="px-2 py-1.5 text-left">Deployed</th>
                <th className="px-2 py-1.5 text-left">Service</th>
                <th className="px-2 py-1.5 text-left">Version</th>
                <th className="px-2 py-1.5 text-left">By</th>
                <th className="px-2 py-1.5 text-left">Status</th>
                <th className="px-2 py-1.5 text-left">Risk</th>
                <th className="px-2 py-1.5 text-left">Rollback target</th>
                <th className="px-2 py-1.5 text-left">Commit</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => (
                <tr key={d.id} className="border-b border-ic-border">
                  <td className="px-2 py-1 text-ic-text-dim">{d.deployedAt.slice(0, 16).replace("T", " ")}</td>
                  <td className="px-2 py-1 text-ic-text">{d.service}</td>
                  <td className="px-2 py-1">{d.version}</td>
                  <td className="px-2 py-1 text-ic-text-dim">{d.deployedBy}</td>
                  <td className="px-2 py-1 text-ic-text-dim">{d.status}</td>
                  <td className="px-2 py-1 text-ic-text-dim">{d.riskScore}</td>
                  <td className="px-2 py-1 text-ic-text-dim">{d.rollbackTargetId ?? "none"}</td>
                  <td className="max-w-[260px] truncate px-2 py-1 text-ic-text-dim" title={d.commitMessage}>
                    {d.commitSha} — {d.commitMessage}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-2 py-3 text-center text-ic-text-dim">
                    No deployments in this scenario's window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  useEffect(() => {
    getAllAlerts().then((r) => setAlerts(r.alerts));
  }, []);
  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <Panel title="ALERTS" className="flex-1">
        <div className="h-full overflow-y-auto font-mono text-[11px]">
          {alerts === null ? (
            <div className="p-3 text-ic-text-dim">Loading…</div>
          ) : alerts.length === 0 ? (
            <div className="p-3 text-ic-text-dim">No alerts have fired.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-ic-border text-ic-text-dim">
                  <th className="px-2 py-1.5 text-left">Fired</th>
                  <th className="px-2 py-1.5 text-left">Name</th>
                  <th className="px-2 py-1.5 text-left">Severity</th>
                  <th className="px-2 py-1.5 text-left">Service</th>
                  <th className="px-2 py-1.5 text-left">Condition</th>
                  <th className="px-2 py-1.5 text-left">Current</th>
                  <th className="px-2 py-1.5 text-left">Incident</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id} className="border-b border-ic-border">
                    <td className="px-2 py-1 text-ic-text-dim">{a.firedAt.slice(11, 16)}</td>
                    <td className="px-2 py-1 text-ic-text">{a.name}</td>
                    <td className="px-2 py-1 text-ic-text-dim">{a.severity}</td>
                    <td className="px-2 py-1 text-ic-text-dim">{a.service}</td>
                    <td className="px-2 py-1 text-ic-text-dim">
                      {a.metric} {a.comparator} {a.threshold}
                    </td>
                    <td className="px-2 py-1 text-ic-text-dim">{a.currentValue}</td>
                    <td className="px-2 py-1 text-ic-text-dim">{a.incidentId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  );
}

export function RunbooksPage() {
  const [runbooks, setRunbooks] = useState<Runbook[] | null>(null);
  useEffect(() => {
    getAllRunbooks().then((r) => setRunbooks(r.runbook ? [r.runbook] : (r.runbooks ?? [])));
  }, []);
  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <Panel title="RUNBOOKS" className="flex-1">
        <div className="h-full overflow-y-auto p-3 font-mono text-[11px]">
          {runbooks === null ? (
            <div className="text-ic-text-dim">Loading…</div>
          ) : runbooks.length === 0 ? (
            <div className="text-ic-text-dim">No runbooks exist for this scenario.</div>
          ) : (
            runbooks.map((rb) => (
              <div key={rb.id} className="mb-4">
                <div className="text-ic-text">
                  {rb.title} <span className="text-ic-text-dim">({rb.id})</span>
                </div>
                <div className="text-ic-text-dim">
                  symptoms: {rb.symptoms.join(", ")} · services: {rb.services.join(", ")}
                </div>
                <ol className="mt-1 list-inside list-decimal">
                  {rb.steps.map((s) => (
                    <li key={s.n} className="mb-0.5 text-ic-text">
                      {s.text} {s.toolHint && <ToolHintChip tool={s.toolHint} />}
                    </li>
                  ))}
                </ol>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}

function outcomeColor(outcome: AuditRecord["outcome"]): string {
  if (outcome === "denied") return "var(--color-ic-down)";
  if (outcome === "error") return "var(--color-ic-degraded)";
  return "var(--color-ic-healthy)";
}

export function ActivityPage() {
  const [events, setEvents] = useState<AuditRecord[] | null>(null);
  useEffect(() => {
    getAudit().then((r) => setEvents(r.events));
  }, []);
  const sorted = events ? [...events].sort((a, b) => b.seq - a.seq) : [];
  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <Panel title="ACTIVITY / AUDIT" className="flex-1">
        <div className="h-full overflow-y-auto font-mono text-[11px]">
          {events === null ? (
            <div className="p-3 text-ic-text-dim">Loading…</div>
          ) : sorted.length === 0 ? (
            <div className="p-3 text-ic-text-dim">No audited calls yet.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-ic-border text-ic-text-dim">
                  <th className="px-2 py-1.5 text-left">#</th>
                  <th className="px-2 py-1.5 text-left">Time</th>
                  <th className="px-2 py-1.5 text-left">Actor</th>
                  <th className="px-2 py-1.5 text-left">Tool</th>
                  <th className="px-2 py-1.5 text-left">Outcome</th>
                  <th className="px-2 py-1.5 text-left">Detail</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((e) => (
                  <tr key={e.seq} className="border-b border-ic-border">
                    <td className="px-2 py-1 text-ic-text-dim">{e.seq}</td>
                    <td className="px-2 py-1 text-ic-text-dim">{e.at.slice(11, 19)}</td>
                    <td className="px-2 py-1 text-ic-text-dim">
                      {e.actor.kind}:{e.actor.identity}
                    </td>
                    <td className="px-2 py-1 text-ic-text">{e.tool}</td>
                    <td className="px-2 py-1 font-semibold" style={{ color: outcomeColor(e.outcome) }}>
                      {e.outcome.toUpperCase()}
                    </td>
                    <td className="max-w-[320px] truncate px-2 py-1 text-ic-text-dim" title={e.denialReason ?? e.resultSummary}>
                      {e.denialReason ?? e.resultSummary}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
    </div>
  );
}
