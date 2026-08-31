import { useEffect, useState, type ReactNode } from "react";
import { SERVICES, SERVICE_IDS } from "@incident-commander/shared";
import type { ServiceId, Deployment, Alert, Runbook, AuditRecord } from "@incident-commander/shared";
import { PageMasthead } from "./Masthead.js";
import { Hint, Region, VitalsStrip, type Vital } from "./Surface.js";
import { Topology } from "./Topology.js";
import { statusColor as statusColorFor, statusLabel } from "./statusColors.js";
import { getAllAlerts, getAllRunbooks, getAudit, type ServiceHealthSummary } from "./api.js";
import { badge, dataRowClass, tdClass, theadRowClass, thClass, type BadgeTone } from "./ui.js";
import { ActivityIcon, AgentIcon, AlertsIcon, DeploymentsIcon, HumanIcon, RunbooksIcon } from "./icons.js";

/**
 * ═══ One page shape, five times ═══
 *
 * Every supporting page was previously the same thing: a padded container
 * holding a single full-height `Panel` card whose only content was a table. The
 * card contributed a border, a shadow and an ALL-CAPS header repeating the word
 * already in the nav — three layers of framing around a table, on a page whose
 * entire purpose is the table.
 *
 * The shape here instead is: display-type masthead, mono sub-line, optional
 * vitals strip, then the table full-bleed to the region's edges. That is the
 * same grammar the incident workspace uses, which is what makes a screenshot of
 * Services and a screenshot of the incident view recognisably one product.
 */
function Page({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col">{children}</div>;
}

/**
 * A table that closes itself.
 *
 * These pages hold between one and a few dozen rows, and stretching the table
 * container to fill a 1050px viewport left several hundred pixels of unexplained
 * void beneath the last row — the "giant empty minimalist page" failure, in a
 * console whose whole argument is density where density is warranted. The table
 * now sizes to its content and ends with a rule and a row count, so the bottom
 * of the list is a deliberate edge rather than a place the design ran out.
 */
function DataTable({ count, children }: { count: number; children: ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-auto border-t border-ic-border">
      <table className="w-full font-mono text-[11px]">{children}</table>
      <div className="flex items-center gap-3 px-3 pb-6 pt-3">
        <span aria-hidden="true" className="h-px w-8 bg-ic-border-strong" />
        <span className="ic-overline">
          {count} {count === 1 ? "row" : "rows"}
        </span>
      </div>
    </div>
  );
}

function Th({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <th className={`${thClass} ${className}`}>{children}</th>;
}

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
      className={badge(known ? "accent" : "critical", "ml-1.5 align-middle")}
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

/* ══════════════════════════════════════════════════════════════════════════ */

export function ServicesPage({ serviceHealth }: { serviceHealth: Partial<Record<ServiceId, ServiceHealthSummary>> }) {
  const known = Object.values(serviceHealth).filter((h): h is ServiceHealthSummary => h !== undefined);
  const count = (s: string) => known.filter((h) => h.status === s).length;
  const worstError = known.reduce((m, h) => Math.max(m, h.errorRate), 0);
  const vitals: Vital[] = [
    { label: "Healthy", value: known.length ? String(count("healthy")) : "—", unit: `/ ${SERVICE_IDS.length}`, tone: "healthy" },
    { label: "Degraded", value: known.length ? String(count("degraded")) : "—", tone: "degraded" },
    { label: "Down", value: known.length ? String(count("down")) : "—", tone: "down" },
    {
      label: "Worst error rate",
      value: known.length ? (worstError * 100).toFixed(2) : "—",
      unit: known.length ? "%" : undefined,
      tone: worstError >= 0.05 ? "down" : worstError >= 0.01 ? "degraded" : "healthy",
    },
  ];

  return (
    <Page>
      <PageMasthead
        title="Service estate"
        meta={
          <>
            {SERVICE_IDS.length} services across 3 tiers
            <span className="mx-2 opacity-40">/</span>
            live health, refreshed with the incident poll
          </>
        }
      />
      <VitalsStrip items={vitals} className="border-y border-ic-border" />
      <div className="shrink-0 overflow-x-auto">
        <table className="w-full font-mono text-[11px]">
        <thead>
          <tr className={theadRowClass}>
            <Th className="w-[150px]">Service</Th>
            <Th className="w-[60px]">Tier</Th>
            <Th className="w-[110px]">Status</Th>
            <Th className="w-[100px]">Error rate</Th>
            <Th className="w-[110px]">Latency p95</Th>
            <Th className="w-[90px]">Instances</Th>
            <Th className="w-[140px]">Owner</Th>
            <Th>Depends on</Th>
          </tr>
        </thead>
        <tbody>
          {SERVICE_IDS.map((id) => {
            const h = serviceHealth[id];
            const s = SERVICES[id];
            return (
              <tr key={id} className={dataRowClass}>
                <td className={`${tdClass} font-sans text-[12px] font-medium text-ic-text`}>{s.displayName}</td>
                <td className={`${tdClass} ic-num text-ic-text-faint`}>T{s.tier}</td>
                <td className={tdClass}>
                  <span className={badge(statusTone(h?.status))}>{statusLabel(h?.status)}</span>
                </td>
                <td className={tdClass}>
                  {h ? (
                    <span className="flex items-center gap-2">
                      <span className="ic-num w-[52px] shrink-0 text-ic-text-dim">{(h.errorRate * 100).toFixed(2)}%</span>
                      {/* Seven percentages in a column are not comparable at a
                          glance; seven bars are. Same sqrt scale the topology
                          dials use, so the two views agree visually. */}
                      <span className="relative h-[3px] w-14 overflow-hidden rounded-full bg-ic-panel-3">
                        <span
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{
                            width: `${Math.max(2, Math.sqrt(Math.min(1, h.errorRate)) * 100)}%`,
                            background: statusColorFor(h.status),
                          }}
                        />
                      </span>
                    </span>
                  ) : (
                    <span className="text-ic-text-faint">—</span>
                  )}
                </td>
                <td className={`${tdClass} ic-num text-ic-text-dim`}>
                  {h?.latencyP95Ms != null ? `${h.latencyP95Ms.toFixed(0)}ms` : "—"}
                </td>
                <td className={`${tdClass} ic-num text-ic-text-dim`}>{s.instances}</td>
                <td className={`${tdClass} text-ic-text-dim`}>{s.owner}</td>
                <td className={`${tdClass} text-ic-text-faint`}>{s.dependsOn.join("  ·  ") || "none"}</td>
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>
      {/* The estate's graph, not a decoration: the table answers "how is each
          service", the graph answers "what does that reach". Same component the
          incident workspace uses, so both views of the estate stay in sync. */}
      <Region label="Dependencies" className="min-h-[220px] flex-1 border-t border-ic-border" bodyClassName="px-2 pb-3">
        <Topology health={serviceHealth} />
      </Region>
    </Page>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */

export function DeploymentsPage({ deployments }: { deployments: Deployment[] }) {
  const sorted = [...deployments].sort((a, b) => b.deployedAtMinute - a.deployedAtMinute);
  // `riskScore` is a low/medium/high union, not a number — rank it explicitly
  // rather than comparing strings.
  const RISK_RANK = { low: 0, medium: 1, high: 2 } as const;
  const riskiest = sorted.reduce<Deployment["riskScore"] | null>(
    (m, d) => (m === null || RISK_RANK[d.riskScore] > RISK_RANK[m] ? d.riskScore : m),
    null
  );
  const vitals: Vital[] = [
    { label: "In window", value: String(sorted.length), note: "deployments", tone: "ink" },
    {
      label: "Highest risk",
      value: riskiest ?? "—",
      tone: riskiest === "high" ? "down" : riskiest === "medium" ? "degraded" : "healthy",
    },
    {
      label: "Most recent",
      value: sorted[0]?.deployedAt.slice(11, 16) ?? "—",
      note: sorted[0]?.service,
      tone: "ink",
    },
    {
      label: "Rollbackable",
      value: String(sorted.filter((d) => d.rollbackTargetId).length),
      note: "have a target",
      tone: "ink",
    },
  ];

  return (
    <Page>
      <PageMasthead
        title="Deployment history"
        meta={
          <>
            Everything shipped inside this scenario&apos;s window
            <span className="mx-2 opacity-40">/</span>
            newest first
          </>
        }
      />
      <VitalsStrip items={vitals} className="border-y border-ic-border" />
      <DataTable count={sorted.length}>
        <thead>
          <tr className={theadRowClass}>
            <Th className="w-[136px]">Deployed</Th>
            <Th className="w-[112px]">Service</Th>
            <Th className="w-[104px]">Version</Th>
            <Th className="w-[120px]">By</Th>
            <Th className="w-[96px]">Status</Th>
            <Th className="w-[60px]">Risk</Th>
            <Th className="w-[152px]">Rollback target</Th>
            <Th>Commit</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((d) => (
            <tr key={d.id} className={dataRowClass}>
              <td className={`${tdClass} ic-num text-[10px] text-ic-text-faint`}>
                {d.deployedAt.slice(0, 16).replace("T", " ")}
              </td>
              <td className={`${tdClass} font-sans text-[12px] font-medium text-ic-text`}>{d.service}</td>
              <td className={`${tdClass} font-medium text-ic-degraded`}>{d.version}</td>
              <td className={`${tdClass} text-ic-text-dim`}>{d.deployedBy}</td>
              <td className={`${tdClass} text-ic-text-dim`}>{d.status}</td>
              <td className={`${tdClass} ic-num text-ic-text-dim`}>{d.riskScore}</td>
              <td className={`${tdClass} text-ic-text-faint`}>{d.rollbackTargetId ?? "none"}</td>
              <td className={`max-w-[300px] truncate ${tdClass} text-ic-text-faint`} title={d.commitMessage}>
                <span className="text-ic-text-dim">{d.commitSha}</span> {d.commitMessage}
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-10">
                <Hint icon={<DeploymentsIcon size={24} />}>No deployments in this scenario&apos;s window.</Hint>
              </td>
            </tr>
          )}
        </tbody>
      </DataTable>
    </Page>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */

export function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[] | null>(null);
  useEffect(() => {
    getAllAlerts().then((r) => setAlerts(r.alerts));
  }, []);

  return (
    <Page>
      <PageMasthead
        title="Alert feed"
        meta={
          <>
            Everything that has fired in this scenario
            <span className="mx-2 opacity-40">/</span>
            <span className="text-ic-text-dim">inspect_alert</span> reads these by id
          </>
        }
        accessory={
          alerts && alerts.length > 0 ? (
            <div className="flex items-baseline gap-2">
              <span className="ic-num text-[26px] text-ic-degraded">{alerts.length}</span>
              <span className="ic-overline">firing</span>
            </div>
          ) : undefined
        }
      />
      {alerts === null ? (
        <div className="min-h-0 flex-1 border-t border-ic-border">
          <Hint>Loading alerts…</Hint>
        </div>
      ) : alerts.length === 0 ? (
        <div className="min-h-0 flex-1 border-t border-ic-border">
          <Hint icon={<AlertsIcon size={26} />}>No alerts have fired in this scenario.</Hint>
        </div>
      ) : (
        <DataTable count={alerts.length}>
          <thead>
            <tr className={theadRowClass}>
              <Th className="w-[80px]">Fired</Th>
              <Th className="w-[240px]">Name</Th>
              <Th className="w-[96px]">Severity</Th>
              <Th className="w-[120px]">Service</Th>
              <Th>Condition</Th>
              <Th className="w-[104px]">Current</Th>
              <Th className="w-[112px]">Incident</Th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id} className={dataRowClass}>
                <td className={`${tdClass} ic-num text-ic-text-faint`}>{a.firedAt.slice(11, 16)}</td>
                <td className={`${tdClass} font-sans text-[12px] font-medium text-ic-text`}>{a.name}</td>
                <td className={tdClass}>
                  <span className={badge(a.severity === "SEV-1" ? "critical" : a.severity === "SEV-2" ? "warning" : "neutral")}>
                    {a.severity}
                  </span>
                </td>
                <td className={`${tdClass} text-ic-text-dim`}>{a.service}</td>
                <td className={`${tdClass} text-ic-text-faint`}>
                  {a.metric} <span className="text-ic-text-dim">{a.comparator}</span> {a.threshold}
                </td>
                <td className={`${tdClass} ic-num text-ic-degraded`}>{a.currentValue}</td>
                <td className={`${tdClass} text-ic-accent`}>{a.incidentId ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </Page>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */

export function RunbooksPage() {
  const [runbooks, setRunbooks] = useState<Runbook[] | null>(null);
  useEffect(() => {
    getAllRunbooks().then((r) => setRunbooks(r.runbook ? [r.runbook] : (r.runbooks ?? [])));
  }, []);

  return (
    <Page>
      <PageMasthead
        title="Runbooks"
        meta={
          <>
            Written procedure, searchable by symptom or service
            <span className="mx-2 opacity-40">/</span>
            <span className="text-ic-text-dim">get_runbook</span> returns these verbatim
          </>
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto border-t border-ic-border">
        {runbooks === null ? (
          <Hint>Loading runbooks…</Hint>
        ) : runbooks.length === 0 ? (
          <Hint icon={<RunbooksIcon size={26} />}>No runbooks exist for this scenario.</Hint>
        ) : (
          <div className="flex max-w-[62ch] flex-col gap-9 px-5 py-6">
            {runbooks.map((rb) => (
              /* A runbook is a document, so this is the one place in the console
                 that is set like one: a measured column, a real heading, and
                 steps in a numbered gutter — not a table row and not a card. */
              <article key={rb.id}>
                <div className="flex items-baseline gap-3">
                  <h2 className="ic-display text-[19px]">{rb.title}</h2>
                  <span className="font-mono text-[10px] text-ic-text-faint">{rb.id}</span>
                </div>
                <p className="ic-meta mt-2 text-ic-text-faint">
                  symptoms <span className="text-ic-text-dim">{rb.symptoms.join(", ")}</span>
                  <span className="mx-2 opacity-40">/</span>
                  services <span className="text-ic-text-dim">{rb.services.join(", ")}</span>
                </p>
                <ol className="mt-4 border-l border-ic-border">
                  {rb.steps.map((s) => (
                    <li key={s.n} className="relative py-2.5 pl-6 pr-2">
                      <span className="ic-num absolute left-0 top-[11px] -translate-x-1/2 rounded-full bg-ic-bg-elevated px-1 text-[10px] text-ic-text-faint">
                        {s.n}
                      </span>
                      <span className="text-[12.5px] leading-[1.55] text-ic-text-dim">{s.text}</span>
                      {s.toolHint && <ToolHintChip tool={s.toolHint} />}
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */

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
  const byAgent = sorted.filter((e) => e.actor.kind === "agent").length;
  const denied = sorted.filter((e) => e.outcome === "denied").length;

  const vitals: Vital[] = [
    { label: "Audited calls", value: String(sorted.length), tone: "ink" },
    { label: "By the agent", value: String(byAgent), tone: "agent", note: "via WebMCP" },
    { label: "By a human", value: String(sorted.length - byAgent), tone: "ink", note: "in the console" },
    { label: "Denied", value: String(denied), tone: denied > 0 ? "down" : "healthy", note: "authority boundary" },
  ];

  return (
    <Page>
      <PageMasthead
        title="Audit trail"
        meta={
          <>
            Every tool call, in order, with its outcome
            <span className="mx-2 opacity-40">/</span>
            nothing happens in this console without an entry here
          </>
        }
      />
      {events !== null && sorted.length > 0 && <VitalsStrip items={vitals} className="border-y border-ic-border" />}
      {events === null ? (
        <div className="min-h-0 flex-1 border-t border-ic-border">
          <Hint>Loading the audit trail…</Hint>
        </div>
      ) : sorted.length === 0 ? (
        <div className="min-h-0 flex-1 border-t border-ic-border">
          <Hint icon={<ActivityIcon size={26} />}>
            No audited calls yet. Every agent tool call and every human decision will appear here.
          </Hint>
        </div>
      ) : (
        <DataTable count={sorted.length}>
          <thead>
            <tr className={theadRowClass}>
              <Th className="w-[56px]">#</Th>
              <Th className="w-[88px]">Time</Th>
              <Th className="w-[180px]">Actor</Th>
              <Th className="w-[210px]">Tool</Th>
              <Th className="w-[112px]">Outcome</Th>
              <Th>Detail</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => (
              <tr key={e.seq} className={dataRowClass}>
                <td className={`${tdClass} ic-num text-ic-text-faint`}>{e.seq}</td>
                <td className={`${tdClass} ic-num text-ic-text-faint`}>{e.at.slice(11, 19)}</td>
                <td className={tdClass}>
                  {/* Who did this is the most important column on this page, so
                      it gets the icon and the colour rule the rest of the
                      console already teaches: cool = machine, bone = human. */}
                  <span className="flex items-center gap-1.5">
                    {e.actor.kind === "agent" ? (
                      <AgentIcon size={12} className="shrink-0 text-ic-accent" />
                    ) : (
                      <HumanIcon size={12} className="shrink-0 text-ic-text-dim" />
                    )}
                    <span className={e.actor.kind === "agent" ? "text-ic-accent" : "text-ic-text"}>{e.actor.kind}</span>
                    <span className="truncate text-ic-text-faint">{e.actor.identity}</span>
                  </span>
                </td>
                <td className={`${tdClass} text-ic-text`}>{e.tool}</td>
                <td className={tdClass}>
                  <span className={badge(outcomeTone(e.outcome))}>{e.outcome}</span>
                </td>
                <td
                  className={`max-w-[380px] truncate ${tdClass} text-ic-text-faint`}
                  title={e.denialReason ?? e.resultSummary}
                >
                  {e.denialReason ?? e.resultSummary}
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
    </Page>
  );
}
