import { useEffect, useState, type ReactNode } from "react";
import { SERVICES, SERVICE_IDS } from "@incident-commander/shared";
import type { ServiceId, Deployment, Alert, Runbook, AuditRecord } from "@incident-commander/shared";
import { Panel } from "./Skeleton.js";
import { statusLabel } from "./statusColors.js";
import { getAllAlerts, getAllRunbooks, getAudit, type ServiceHealthSummary } from "./api.js";
import { badge, type BadgeTone } from "./ui.js";
import { ActivityIcon, RunbooksIcon } from "./icons.js";

function EmptyState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 text-ic-text-faint">
      <span className="opacity-50">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

const ALL_TOOL_NAMES = new Set([
  "get_active_incidents", "get_incident", "get_incident_timeline", "get_service_health",
  "get_service_dependencies", "get_recent_deployments", "get_recent_changes", "query_logs",
  "search_traces", "compare_metrics", "inspect_alert", "get_runbook",
  "assign_incident", "resolve_incident", "rollback_deployment", "restart_service",
  "scale_service", "disable_feature_flag", "get_pending_approvals", "request_approval",
  "record_approval", "create_incident", "add_incident_note",
]);

const th = "px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-ic-text-faint";
const td = "px-3 py-2";
const row = "border-b border-ic-border/70 transition-colors duration-150 hover:bg-ic-panel-2/40";

/** A runbook's `toolHint` should always name a real tool (plan §9 Phase 9 exit criterion) — styled distinctly if it somehow doesn't, rather than silently rendered as if it were fine. */
function ToolHintChip({ tool }: { tool: string }) {
  const known = ALL_TOOL_NAMES.has(tool);
  return (
    <span
      className={badge(known ? "accent" : "critical")}
      title={known ? "Resolves to a registered tool" : "Does not match any registered tool"}
    >
      {tool}
    </span>
  );
}

function statusTone(status: ServiceHealthSummary["status"] | undefined): BadgeTone {
  if (status === "healthy") return "healthy";
  if (status === "degraded") return "warning";
  if (status === "down") return "critical";
  return "neutral";
}

export function ServicesPage({ serviceHealth }: { serviceHealth: Partial<Record<ServiceId, ServiceHealthSummary>> }) {
  return (
    <div className="flex h-full flex-col gap-3.5 p-3.5">
      <Panel title="SERVICES" className="flex-1">
        <div className="h-full overflow-y-auto font-mono text-[11px]">
          <table className="w-full">
            <thead>
              <tr className="sticky top-0 z-[1] border-b border-ic-border bg-ic-panel">
                <th className={th}>Service</th>
                <th className={th}>Tier</th>
                <th className={th}>Status</th>
                <th className={th}>Error rate</th>
                <th className={th}>Latency p95</th>
                <th className={th}>Instances</th>
                <th className={th}>Owner</th>
                <th className={th}>Depends on</th>
              </tr>
            </thead>
            <tbody>
              {SERVICE_IDS.map((id) => {
                const h = serviceHealth[id];
                const s = SERVICES[id];
                return (
                  <tr key={id} className={row}>
                    <td className={`${td} font-semibold text-ic-text`}>{s.displayName}</td>
                    <td className={`${td} text-ic-text-dim`}>{s.tier}</td>
                    <td className={td}>
                      <span className={badge(statusTone(h?.status))}>{statusLabel(h?.status)}</span>
                    </td>
                    <td className={`${td} tabular-nums text-ic-text-dim`}>{h ? `${(h.errorRate * 100).toFixed(2)}%` : "—"}</td>
                    <td className={`${td} tabular-nums text-ic-text-dim`}>{h?.latencyP95Ms != null ? `${h.latencyP95Ms.toFixed(0)}ms` : "—"}</td>
                    <td className={`${td} tabular-nums text-ic-text-dim`}>{s.instances}</td>
                    <td className={`${td} text-ic-text-dim`}>{s.owner}</td>
                    <td className={`${td} text-ic-text-faint`}>{s.dependsOn.join(", ") || "none"}</td>
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
    <div className="flex h-full flex-col gap-3.5 p-3.5">
      <Panel title="DEPLOYMENTS" className="flex-1">
        <div className="h-full overflow-y-auto font-mono text-[11px]">
          <table className="w-full">
            <thead>
              <tr className="sticky top-0 z-[1] border-b border-ic-border bg-ic-panel">
                <th className={th}>Deployed</th>
                <th className={th}>Service</th>
                <th className={th}>Version</th>
                <th className={th}>By</th>
                <th className={th}>Status</th>
                <th className={th}>Risk</th>
                <th className={th}>Rollback target</th>
                <th className={th}>Commit</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((d) => (
                <tr key={d.id} className={row}>
                  <td className={`${td} text-ic-text-dim`}>{d.deployedAt.slice(0, 16).replace("T", " ")}</td>
                  <td className={`${td} font-semibold text-ic-text`}>{d.service}</td>
                  <td className={`${td} text-ic-accent-2`}>{d.version}</td>
                  <td className={`${td} text-ic-text-dim`}>{d.deployedBy}</td>
                  <td className={`${td} text-ic-text-dim`}>{d.status}</td>
                  <td className={`${td} text-ic-text-dim`}>{d.riskScore}</td>
                  <td className={`${td} text-ic-text-dim`}>{d.rollbackTargetId ?? "none"}</td>
                  <td className={`max-w-[260px] truncate ${td} text-ic-text-faint`} title={d.commitMessage}>
                    {d.commitSha} — {d.commitMessage}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-ic-text-faint">
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
    <div className="flex h-full flex-col gap-3.5 p-3.5">
      <Panel title="ALERTS" className="flex-1">
        <div className="h-full overflow-y-auto font-mono text-[11px]">
          {alerts === null ? (
            <div className="p-4 text-ic-text-faint">Loading…</div>
          ) : alerts.length === 0 ? (
            <div className="p-4 text-ic-text-faint">No alerts have fired.</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="sticky top-0 z-[1] border-b border-ic-border bg-ic-panel">
                  <th className={th}>Fired</th>
                  <th className={th}>Name</th>
                  <th className={th}>Severity</th>
                  <th className={th}>Service</th>
                  <th className={th}>Condition</th>
                  <th className={th}>Current</th>
                  <th className={th}>Incident</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id} className={row}>
                    <td className={`${td} tabular-nums text-ic-text-dim`}>{a.firedAt.slice(11, 16)}</td>
                    <td className={`${td} font-semibold text-ic-text`}>{a.name}</td>
                    <td className={`${td} text-ic-text-dim`}>{a.severity}</td>
                    <td className={`${td} text-ic-text-dim`}>{a.service}</td>
                    <td className={`${td} text-ic-text-dim`}>
                      {a.metric} {a.comparator} {a.threshold}
                    </td>
                    <td className={`${td} tabular-nums text-ic-degraded`}>{a.currentValue}</td>
                    <td className={`${td} text-ic-accent`}>{a.incidentId ?? "—"}</td>
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
    <div className="flex h-full flex-col gap-3.5 p-3.5">
      <Panel title="RUNBOOKS" className="flex-1">
        <div className="h-full overflow-y-auto p-4 font-mono text-[11px]">
          {runbooks === null ? (
            <div className="text-ic-text-faint">Loading…</div>
          ) : runbooks.length === 0 ? (
            <EmptyState icon={<RunbooksIcon width={32} height={32} />} text="No runbooks exist for this scenario." />
          ) : (
            runbooks.map((rb) => (
              <div key={rb.id} className="mb-5 rounded-xl border border-ic-border bg-ic-panel-2/40 p-3.5">
                <div className="text-[12px] font-semibold text-ic-text">
                  {rb.title} <span className="font-normal text-ic-text-faint">({rb.id})</span>
                </div>
                <div className="mt-1 text-ic-text-dim">
                  symptoms: {rb.symptoms.join(", ")} · services: {rb.services.join(", ")}
                </div>
                <ol className="mt-2.5 list-inside list-decimal space-y-1.5">
                  {rb.steps.map((s) => (
                    <li key={s.n} className="text-ic-text">
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

function outcomeTone(outcome: AuditRecord["outcome"]): BadgeTone {
  if (outcome === "denied") return "critical";
  if (outcome === "error") return "warning";
  return "healthy";
}

export function ActivityPage() {
  const [events, setEvents] = useState<AuditRecord[] | null>(null);
  useEffect(() => {
    getAudit().then((r) => setEvents(r.events));
  }, []);
  const sorted = events ? [...events].sort((a, b) => b.seq - a.seq) : [];
  return (
    <div className="flex h-full flex-col gap-3.5 p-3.5">
      <Panel title="ACTIVITY / AUDIT" className="flex-1">
        <div className="h-full overflow-y-auto font-mono text-[11px]">
          {events === null ? (
            <div className="p-4 text-ic-text-faint">Loading…</div>
          ) : sorted.length === 0 ? (
            <EmptyState icon={<ActivityIcon width={32} height={32} />} text="No audited calls yet." />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="sticky top-0 z-[1] border-b border-ic-border bg-ic-panel">
                  <th className={th}>#</th>
                  <th className={th}>Time</th>
                  <th className={th}>Actor</th>
                  <th className={th}>Tool</th>
                  <th className={th}>Outcome</th>
                  <th className={th}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((e) => (
                  <tr key={e.seq} className={row}>
                    <td className={`${td} tabular-nums text-ic-text-faint`}>{e.seq}</td>
                    <td className={`${td} tabular-nums text-ic-text-dim`}>{e.at.slice(11, 19)}</td>
                    <td className={`${td} text-ic-text-dim`}>
                      {e.actor.kind}:{e.actor.identity}
                    </td>
                    <td className={`${td} text-ic-text`}>{e.tool}</td>
                    <td className={td}>
                      <span className={badge(outcomeTone(e.outcome))}>{e.outcome}</span>
                    </td>
                    <td className={`max-w-[320px] truncate ${td} text-ic-text-faint`} title={e.denialReason ?? e.resultSummary}>
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
