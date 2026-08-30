import type { Incident } from "@incident-commander/shared";
import { Panel, Skeleton } from "./Skeleton.js";
import { Topology } from "./Topology.js";
import { MetricsChart } from "./MetricsChart.js";
import { EvidenceTabs } from "./EvidenceTabs.js";
import { Timeline } from "./Timeline.js";
import { EvidenceSpotlight } from "./EvidenceSpotlight.js";
import { useGlowingCall } from "./toolActivity.js";
import type { ConsoleData } from "./useConsoleData.js";

function severityColor(severity: string): string {
  if (severity === "SEV-1") return "var(--color-ic-down)";
  if (severity === "SEV-2") return "var(--color-ic-degraded)";
  return "var(--color-ic-text-dim)";
}

function IncidentHeader({ incident, glowing }: { incident: Incident; glowing: boolean }) {
  return (
    <div
      className={`flex h-14 shrink-0 items-center gap-3 border-b px-3 transition-colors duration-300 ${
        glowing ? "border-ic-accent bg-ic-panel-2" : "border-ic-border"
      }`}
    >
      <span className="font-mono text-sm font-semibold text-ic-text">{incident.id}</span>
      <span className="text-sm text-ic-text-dim">{incident.title}</span>
      <span
        className="rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ic-bg"
        style={{ background: severityColor(incident.severity) }}
      >
        {incident.severity}
      </span>
      <span className="rounded bg-ic-panel-2 px-1.5 py-0.5 font-mono text-[11px] text-ic-text">
        {incident.state}
      </span>
      <span className="ml-auto font-mono text-[11px] text-ic-text-dim">opened {incident.openedAt.slice(11, 16)}</span>
    </div>
  );
}

export function IncidentWorkspace({ data }: { data: ConsoleData }) {
  if (data.error) {
    return <div className="p-4 text-sm text-ic-down">Failed to load console data: {data.error}</div>;
  }

  if (!data.incident) {
    return (
      <div className="flex h-full flex-col gap-3 p-3">
        <Skeleton className="h-14 shrink-0" />
        <Skeleton className="h-64 shrink-0" />
        <Skeleton className="h-72 shrink-0" />
        <Skeleton className="h-80 shrink-0" />
      </div>
    );
  }

  return <Loaded data={data} incident={data.incident} />;
}

/**
 * Split out so the panel-level glow hooks (plan §9's "which section is the
 * agent's most recent call about") only run once an incident actually
 * exists — hooks can't be conditional, and the loading/error branches above
 * return before any incident is available.
 */
function Loaded({ data, incident }: { data: ConsoleData; incident: Incident }) {
  const headerGlow = useGlowingCall(["get_active_incidents", "get_incident"]);
  const topologyGlow = useGlowingCall(["get_service_health", "get_service_dependencies"]);
  const metricsGlow = useGlowingCall(["get_recent_deployments", "compare_metrics"]);
  const evidenceGlow = useGlowingCall(["query_logs", "search_traces", "get_recent_deployments", "get_recent_changes"]);
  const timelineGlow = useGlowingCall(["get_incident", "get_incident_timeline", "get_recent_changes"]);

  return (
    <div className="relative flex h-full flex-col">
      <IncidentHeader incident={incident} glowing={headerGlow !== null} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <Panel title="TOPOLOGY" className="h-72 shrink-0" glow={topologyGlow && (topologyGlow.pending ? "pending" : "settled")}>
          {Object.keys(data.serviceHealth).length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Skeleton className="h-56 w-full" />
            </div>
          ) : (
            <Topology health={data.serviceHealth} transitioningServices={incident.state === "RECOVERING" ? incident.affectedServices : []} />
          )}
        </Panel>

        <Panel title="METRICS" className="h-72 shrink-0" glow={metricsGlow && (metricsGlow.pending ? "pending" : "settled")}>
          {data.metricSeries.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Skeleton className="h-56 w-full" />
            </div>
          ) : (
            <MetricsChart series={data.metricSeries} deployments={data.deployments} />
          )}
        </Panel>

        <Panel title="EVIDENCE" className="h-80 shrink-0" glow={evidenceGlow && (evidenceGlow.pending ? "pending" : "settled")}>
          <EvidenceTabs
            logs={data.logs}
            logsNote={data.logsNote}
            traces={data.traces}
            tracesNote={data.tracesNote}
            deployments={data.deployments}
            changes={data.changes}
          />
        </Panel>

        <Panel title="TIMELINE" className="h-56 shrink-0" glow={timelineGlow && (timelineGlow.pending ? "pending" : "settled")}>
          <Timeline events={incident.timeline} changes={data.changes} />
        </Panel>
      </div>
      <EvidenceSpotlight />
    </div>
  );
}
