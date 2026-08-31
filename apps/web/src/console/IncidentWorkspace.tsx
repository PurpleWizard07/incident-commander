import type { Incident } from "@incident-commander/shared";
import { Panel, Skeleton } from "./Skeleton.js";
import { Topology } from "./Topology.js";
import { MetricsChart } from "./MetricsChart.js";
import { EvidenceTabs } from "./EvidenceTabs.js";
import { Timeline } from "./Timeline.js";
import { EvidenceSpotlight } from "./EvidenceSpotlight.js";
import { AddNoteForm, CreateIncidentForm } from "./DeclarativeForms.js";
import { useGlowingCall } from "./toolActivity.js";
import { computeConfidence, type ConfidenceLevel } from "./confidence.js";
import type { ConsoleData } from "./useConsoleData.js";
import { badge, type BadgeTone } from "./ui.js";

function severityTone(severity: string): BadgeTone {
  if (severity === "SEV-1") return "critical";
  if (severity === "SEV-2") return "warning";
  return "neutral";
}

function confidenceTone(level: ConfidenceLevel): BadgeTone {
  if (level === "Strong") return "healthy";
  if (level === "Moderate") return "warning";
  return "neutral";
}

function IncidentHeader({ incident, glowing }: { incident: Incident; glowing: boolean }) {
  const confidence = computeConfidence(incident);
  const tooltip = `${confidence.supportingSignals} supporting signal(s) · ${confidence.alternativesFalsified} alternative(s) falsified · ${confidence.unexplainedObservations} unexplained observation(s)`;
  return (
    <div
      className={`flex h-14 shrink-0 items-center gap-3 border-b bg-ic-bg-elevated px-4 transition-colors duration-300 ${
        glowing ? "border-ic-accent/60 shadow-[inset_0_-1px_0_0_var(--color-ic-accent)]" : "border-ic-border"
      }`}
    >
      <span className="font-mono text-sm font-semibold tracking-tight text-ic-text">{incident.id}</span>
      <span className="text-sm text-ic-text-dim">{incident.title}</span>
      <span className={badge(severityTone(incident.severity))}>{incident.severity}</span>
      <span className={badge("neutral")}>{incident.state}</span>
      <span title={tooltip} className={badge(confidenceTone(confidence.level))}>
        confidence: {confidence.level}
      </span>
      <span className="ml-auto font-mono text-[11px] tabular-nums text-ic-text-faint">
        opened {incident.openedAt.slice(11, 16)}
      </span>
    </div>
  );
}

export function IncidentWorkspace({ data, refresh }: { data: ConsoleData; refresh: () => void }) {
  if (data.error) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="animate-fade-up rounded-xl border border-ic-down/30 bg-ic-down/[0.06] px-4 py-3 text-sm text-ic-down">
          Failed to load console data: {data.error}
        </div>
      </div>
    );
  }

  if (!data.incident) {
    // Mirrors `Loaded`'s exact structure — header outside the padded scroll
    // area, then TOPOLOGY/METRICS/EVIDENCE/TIMELINE/ACTIONS in that order at
    // their real heights — so nothing shifts size or position when the real
    // incident data replaces it (plan §21.2).
    return (
      <div className="flex h-full flex-col">
        <Skeleton className="h-14 shrink-0" />
        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-hidden p-3.5">
          <Skeleton className="h-80 shrink-0" />
          <Skeleton className="h-72 shrink-0" />
          <Skeleton className="h-80 shrink-0" />
          <Skeleton className="h-56 shrink-0" />
          <Skeleton className="h-64 shrink-0" />
        </div>
      </div>
    );
  }

  return <Loaded data={data} incident={data.incident} refresh={refresh} />;
}

/**
 * Split out so the panel-level glow hooks (plan §9's "which section is the
 * agent's most recent call about") only run once an incident actually
 * exists — hooks can't be conditional, and the loading/error branches above
 * return before any incident is available.
 */
function Loaded({ data, incident, refresh }: { data: ConsoleData; incident: Incident; refresh: () => void }) {
  const headerGlow = useGlowingCall(["get_active_incidents", "get_incident"]);
  const topologyGlow = useGlowingCall(["get_service_health", "get_service_dependencies"]);
  const metricsGlow = useGlowingCall(["get_recent_deployments", "compare_metrics"]);
  const evidenceGlow = useGlowingCall(["query_logs", "search_traces", "get_recent_deployments", "get_recent_changes"]);
  const timelineGlow = useGlowingCall(["get_incident", "get_incident_timeline", "get_recent_changes"]);

  return (
    <div className="relative flex h-full flex-col">
      <IncidentHeader incident={incident} glowing={headerGlow !== null} />
      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-3.5">
        <Panel title="TOPOLOGY" className="h-80 shrink-0" glow={topologyGlow && (topologyGlow.pending ? "pending" : "settled")}>
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

        {/* Declarative WebMCP (plan §21.3) — record-changing actions, matched to a lighter risk
            tier than the approval-gated production actions: the agent fills the form, a human
            still has to press Submit. Chrome discovers a declarative tool purely from the
            `<form toolname>` element being in the DOM — there is no imperative unregister call
            for it, so "observer sees no action tools" (plan §8.1) means literally not rendering
            these forms at all for that role, not just hiding them with CSS. */}
        <Panel title="ACTIONS" className="h-64 shrink-0">
          {data.role === "observer" ? (
            <div className="flex h-full items-center justify-center p-3 text-center text-[11px] text-ic-text-faint">
              Observer role — no actions available.
            </div>
          ) : (
            <div className="flex h-full flex-col gap-2.5 overflow-y-auto p-2.5">
              <AddNoteForm incidentId={incident.id} onSubmitted={refresh} />
              <CreateIncidentForm onSubmitted={refresh} />
            </div>
          )}
        </Panel>
      </div>
      <EvidenceSpotlight />
    </div>
  );
}
