import type { Incident } from "@incident-commander/shared";
import { Panel, Skeleton } from "./Skeleton.js";
import { Topology } from "./Topology.js";
import { MetricsChart } from "./MetricsChart.js";
import { EvidenceTabs } from "./EvidenceTabs.js";
import { Timeline } from "./Timeline.js";
import type { ConsoleData } from "./useConsoleData.js";

function severityColor(severity: string): string {
  if (severity === "SEV-1") return "var(--color-ic-down)";
  if (severity === "SEV-2") return "var(--color-ic-degraded)";
  return "var(--color-ic-text-dim)";
}

function IncidentHeader({ incident }: { incident: Incident }) {
  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b border-ic-border px-3">
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

  return (
    <div className="flex h-full flex-col">
      <IncidentHeader incident={data.incident} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
        <Panel title="TOPOLOGY" className="h-72 shrink-0">
          {Object.keys(data.serviceHealth).length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Skeleton className="h-56 w-full" />
            </div>
          ) : (
            <Topology health={data.serviceHealth} />
          )}
        </Panel>

        <Panel title="METRICS" className="h-72 shrink-0">
          {data.metricSeries.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Skeleton className="h-56 w-full" />
            </div>
          ) : (
            <MetricsChart series={data.metricSeries} deployments={data.deployments} />
          )}
        </Panel>

        <Panel title="EVIDENCE" className="h-80 shrink-0">
          <EvidenceTabs
            logs={data.logs}
            logsNote={data.logsNote}
            traces={data.traces}
            tracesNote={data.tracesNote}
            deployments={data.deployments}
            changes={data.changes}
          />
        </Panel>

        <Panel title="TIMELINE" className="h-56 shrink-0">
          <Timeline events={data.incident.timeline} />
        </Panel>
      </div>
    </div>
  );
}
