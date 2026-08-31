import type { Incident, ServiceId } from "@incident-commander/shared";
import { Region, Skeleton, VitalsStrip, type Vital } from "./Surface.js";
import { IncidentMasthead } from "./Masthead.js";
import { Topology } from "./Topology.js";
import { MetricsChart } from "./MetricsChart.js";
import { EvidenceTabs } from "./EvidenceTabs.js";
import { Timeline } from "./Timeline.js";
import { EvidenceSpotlight } from "./EvidenceSpotlight.js";
import { AddNoteForm, CreateIncidentForm } from "./DeclarativeForms.js";
import { useGlowingCall } from "./toolActivity.js";
import { computeConfidence, type ConfidenceLevel } from "./confidence.js";
import type { ConsoleData } from "./useConsoleData.js";
import type { ServiceHealthSummary } from "./api.js";

function glowState(g: { pending: boolean } | null): "pending" | "settled" | null {
  if (!g) return null;
  return g.pending ? "pending" : "settled";
}

function confidenceTone(level: ConfidenceLevel): Vital["tone"] {
  if (level === "Strong") return "healthy";
  if (level === "Moderate") return "degraded";
  return "ink";
}

function errorTone(rate: number): Vital["tone"] {
  if (rate >= 0.05) return "down";
  if (rate >= 0.01) return "degraded";
  return "healthy";
}

/**
 * The vitals are derived from data the console has already loaded for the
 * topology and the evidence tabs — no new request, and deliberately no ground
 * truth (plan §3.9). Confidence in particular is counted from what the agent
 * itself cited and admitted, never self-reported and never from the scenario
 * (plan §9.2, `confidence.ts`).
 */
function buildVitals(incident: Incident, health: Partial<Record<ServiceId, ServiceHealthSummary>>): Vital[] {
  const affected = incident.affectedServices
    .map((s) => health[s])
    .filter((h): h is ServiceHealthSummary => h !== undefined);
  const worstError = affected.reduce((m, h) => Math.max(m, h.errorRate), 0);
  const worstLatency = affected.reduce((m, h) => Math.max(m, h.latencyP95Ms ?? 0), 0);
  const unhealthy = Object.values(health).filter((h) => h && h.status !== "healthy").length;
  const known = Object.keys(health).length;
  const confidence = computeConfidence(incident);

  return [
    {
      label: "Error rate",
      value: affected.length ? (worstError * 100).toFixed(2) : "—",
      unit: affected.length ? "%" : undefined,
      tone: affected.length ? errorTone(worstError) : "ink",
      note: "worst",
    },
    {
      label: "Latency p95",
      value: worstLatency ? worstLatency.toFixed(0) : "—",
      unit: worstLatency ? "ms" : undefined,
      tone: !worstLatency ? "ink" : worstLatency >= 1000 ? "down" : worstLatency >= 400 ? "degraded" : "healthy",
      note: worstLatency ? "worst" : "no data",
    },
    {
      label: "Unhealthy",
      value: known ? String(unhealthy) : "—",
      unit: known ? `/ ${known}` : undefined,
      tone: unhealthy >= 3 ? "down" : unhealthy > 0 ? "degraded" : "healthy",
      note: "services",
    },
    {
      label: "Confidence",
      value: confidence.level,
      tone: confidenceTone(confidence.level),
      note: `${confidence.supportingSignals} cited`,
      title: `${confidence.supportingSignals} supporting signal(s) · ${confidence.alternativesFalsified} alternative(s) falsified · ${confidence.unexplainedObservations} unexplained observation(s)`,
    },
  ];
}

export function IncidentWorkspace({ data, refresh }: { data: ConsoleData; refresh: () => void }) {
  if (data.error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="animate-fade-up max-w-md rounded-lg border border-ic-down/30 bg-ic-down/[0.06] px-4 py-3.5">
          <div className="ic-overline mb-1.5 text-ic-down">Console offline</div>
          <p className="text-[12px] leading-relaxed text-ic-text-dim">{data.error}</p>
        </div>
      </div>
    );
  }

  if (!data.incident) {
    // Mirrors `Loaded`'s exact structure at its real heights — masthead, vitals
    // strip, the two-up analysis row, evidence, the two-up bottom row — so
    // nothing shifts size or position when the real incident arrives (plan §21.2).
    return (
      <div className="flex h-full flex-col">
        <div className="shrink-0 px-5 pb-4 pt-4">
          <Skeleton className="h-4 w-52" />
          <Skeleton className="mt-3 h-8 w-[26rem]" />
          <Skeleton className="mt-3 h-3 w-72" />
        </div>
        <div className="flex shrink-0 items-stretch border-y border-ic-border">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`flex-1 px-4 py-3 ${i > 0 ? "border-l border-ic-border/70" : ""}`}>
              <Skeleton className="h-7 w-20" />
              <Skeleton className="mt-2.5 h-2.5 w-16" />
            </div>
          ))}
        </div>
        <div className="grid h-[292px] shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] border-b border-ic-border">
          <div className="border-r border-ic-border p-4">
            <Skeleton className="h-full w-full" />
          </div>
          <div className="p-4">
            <Skeleton className="h-full w-full" />
          </div>
        </div>
        <div className="min-h-0 flex-1 p-4">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="grid h-[232px] shrink-0 grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] border-t border-ic-border">
          <div className="border-r border-ic-border p-4">
            <Skeleton className="h-full w-full" />
          </div>
          <div className="p-4">
            <Skeleton className="h-full w-full" />
          </div>
        </div>
      </div>
    );
  }

  return <Loaded data={data} incident={data.incident} refresh={refresh} />;
}

/**
 * ═══ The composition ═══
 *
 * What this replaces: a single vertically scrolling column of five identical
 * rounded cards — TOPOLOGY (h-80), METRICS (h-72), EVIDENCE (h-80), TIMELINE
 * (h-56), ACTIONS (h-64) — stacked in that order. On a laptop you could see
 * about one and a half of them, so correlating a spike in the chart with a log
 * line meant scrolling between them, which is the one thing this console exists
 * to make unnecessary.
 *
 * The new layout is a real grid and it fits, whole, on a 1080p screen:
 *
 *   masthead        the incident, as the largest type on the page
 *   vitals          five bare numerals, no container
 *   TOPOLOGY | SIGNAL   side by side, because "which service" and "when did it
 *                       start" are one question and were two scroll positions
 *   EVIDENCE            full width and the largest region, because it holds the
 *                       densest data and does the most work
 *   TIMELINE | OPEN INCIDENT
 *
 * The note composer is docked inside the TIMELINE region rather than living in
 * a separate ACTIONS card, because a note *is* a timeline entry — the old
 * layout put the two 500px apart.
 *
 * Both `<form toolname>` elements still render unconditionally for non-observer
 * roles. Chrome discovers a declarative tool purely from the element being in
 * the DOM and there is no imperative unregister for it, so "an observer sees no
 * action tools" (plan §8.1) has to mean literally not rendering them — never
 * just hiding them with CSS.
 */
function Loaded({ data, incident, refresh }: { data: ConsoleData; incident: Incident; refresh: () => void }) {
  const headerGlow = useGlowingCall(["get_active_incidents", "get_incident"]);
  const topologyGlow = useGlowingCall(["get_service_health", "get_service_dependencies"]);
  const metricsGlow = useGlowingCall(["get_recent_deployments", "compare_metrics"]);
  const evidenceGlow = useGlowingCall(["query_logs", "search_traces", "get_recent_deployments", "get_recent_changes"]);
  const timelineGlow = useGlowingCall(["get_incident", "get_incident_timeline", "get_recent_changes"]);

  const isObserver = data.role === "observer";

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-y-auto">
      <IncidentMasthead incident={incident} glowing={headerGlow !== null} />

      <VitalsStrip items={buildVitals(incident, data.serviceHealth)} className="border-y border-ic-border" />

      <div className="grid h-[292px] shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] border-b border-ic-border">
        <Region
          label="Topology"
          glow={glowState(topologyGlow)}
          className="border-r border-ic-border"
          bodyClassName="px-2 pb-2"
        >
          {Object.keys(data.serviceHealth).length === 0 ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <Topology
              health={data.serviceHealth}
              transitioningServices={incident.state === "RECOVERING" ? incident.affectedServices : []}
            />
          )}
        </Region>

        <Region label="Signal" glow={glowState(metricsGlow)}>
          {data.metricSeries.length === 0 ? (
            <div className="h-full px-4 pb-4">
              <Skeleton className="h-full w-full" />
            </div>
          ) : (
            <MetricsChart series={data.metricSeries} deployments={data.deployments} />
          )}
        </Region>
      </div>

      <Region label="Evidence" glow={glowState(evidenceGlow)} className="min-h-[184px] flex-1">
        <EvidenceTabs
          logs={data.logs}
          logsNote={data.logsNote}
          traces={data.traces}
          tracesNote={data.tracesNote}
          deployments={data.deployments}
          changes={data.changes}
        />
      </Region>

      <div
        className={`grid h-[232px] shrink-0 border-t border-ic-border ${
          isObserver ? "grid-cols-1" : "grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]"
        }`}
      >
        <Region
          label="Timeline"
          glow={glowState(timelineGlow)}
          className={isObserver ? "" : "border-r border-ic-border"}
        >
          <Timeline
            events={incident.timeline}
            changes={data.changes}
            composer={isObserver ? null : <AddNoteForm incidentId={incident.id} onSubmitted={refresh} />}
          />
        </Region>

        {!isObserver && (
          <Region label="Open incident">
            <CreateIncidentForm onSubmitted={refresh} />
          </Region>
        )}
      </div>

      <EvidenceSpotlight />
    </div>
  );
}
