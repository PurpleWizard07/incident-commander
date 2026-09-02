import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SessionBar } from "./Masthead.js";
import { Nav, type Section } from "./Nav.js";
import { Ground, SeverityLeak, type GroundTone } from "./Surface.js";
import { IncidentWorkspace } from "./IncidentWorkspace.js";
import { ServicesPage, DeploymentsPage, AlertsPage, RunbooksPage, ActivityPage } from "./SupportingPages.js";
import { AgentLane, AgentRail } from "./AgentLane.js";
import { useConsoleData } from "./useConsoleData.js";
import { useToolRecords } from "./toolActivity.js";
import { hasAgentInterface } from "../webmcp/registerTools.js";
import { registerDynamicTools } from "../webmcp/registerTools.js";
import { setRole as apiSetRole } from "./api.js";

const SECTION_LABELS: Record<Section, string> = {
  incidents: "Incident workspace",
  services: "Service estate",
  deployments: "Deployment history",
  alerts: "Alert feed",
  runbooks: "Runbooks",
  activity: "Audit trail",
};

/** The room's colour temperature follows the live incident. See `Ground`. */
function groundTone(severity: string | undefined, state: string | null): GroundTone {
  if (state === "RESOLVED" || state === "RECOVERING") return "calm";
  if (severity === "SEV-1") return "critical";
  if (severity === "SEV-2") return "warning";
  return "neutral";
}

/**
 * ═══ Shell composition ═══
 *
 * Plan §13.1 asked for header / left nav / incident workspace / permanent right
 * rail, and all four are still here — but arranged as three depth layers rather
 * than as a topbar over three columns:
 *
 *   ground   the atmospheric layers, tinted by incident severity
 *   rail     the command rail, sitting ON the ground (darker than the sheet)
 *   sheet    one continuous application surface holding the session bar, the
 *            workspace and the agent lane, divided by hairlines rather than
 *            by gaps between cards
 *
 * Column widths stay fixed rather than content-driven, so the grid never
 * reflows — CLS discipline applies to the shell itself, not just its panels
 * (plan §21.2).
 *
 * ── The agent lane is a drawer, not a column ──
 *
 * It used to hold a permanent 352px grid column. That column was sized for its
 * rare peak — an approval card — while its normal state is empty or a short
 * list of mono lines, and it cost the workspace real room: on a 1440px screen
 * the incident view got 1024px and the topology graph about 465px.
 *
 * So the grid reserves 44px for `AgentRail` and the lane slides out OVER the
 * sheet. Two consequences worth naming:
 *
 *  · Opening or closing it never reflows the workspace. The log line you were
 *    reading does not move, which matters because a tool call can open the lane
 *    on its own.
 *  · Nothing about the agent can hide behind a collapsed lane. The rail carries
 *    the working state and the pending-approval marker, and an approval landing
 *    opens the lane itself — human authority is not something you can
 *    accidentally put away.
 */
export function AppShell() {
  const records = useToolRecords();
  // Plan §2.2's third poll tier: while a tool call is in flight the console
  // polls at 750ms instead of 2s, so an action the agent takes shows up in the
  // shared view close to when it lands rather than up to two seconds later.
  // `useConsoleData` cannot read this itself — it sits below the provider.
  const agentWorking = records.some((r) => r.settledAt === null);
  const { data, refresh, switchScenario } = useConsoleData(agentWorking ? "activity" : undefined);
  const [section, setSection] = useState<Section>("incidents");
  // ── Whether the lane starts open ──
  //
  // Open, and the drawer covers the right edge of the workspace at first paint
  // — which is the exact complaint the collapse was built to answer. Closed,
  // and a reader who will never see a tool call never sees the one sentence
  // that explains how to get one.
  //
  // Both are true, for different readers, and the same feature detection that
  // decides the empty state's copy resolves it:
  //
  //  · An agent interface is present (ChatGPT's in-app browser, Chrome with the
  //    flag or the origin trial) — start CLOSED. The workspace gets its full
  //    width, and the lane opens itself the moment the agent actually does
  //    something, which is the only point at which there is anything to read.
  //  · No agent interface — start OPEN. Nothing will ever auto-open it, and the
  //    lane is where this browser is told, plainly, that nothing can drive the
  //    console but the person sitting there.
  const [laneOpen, setLaneOpen] = useState(() => !hasAgentInterface());

  const incidentId = data.incident?.id ?? null;
  const incidentState = data.incident?.state ?? null;
  const hasPendingApproval = data.pendingApprovals.length > 0;

  // The lane opens itself for exactly two events, and they are the two a
  // responder must not miss: the agent's first call of a session (something
  // else is now operating this console), and an approval landing (a production
  // change is blocked on you).
  //
  // Calls *during* an investigation deliberately do not force it back open. If
  // you collapsed the lane on purpose, the rail's lit edge and call count are
  // enough, and re-opening a panel on every tool call would be the console
  // fighting the person using it.
  const started = records.length > 0;
  const prevStarted = useRef(started);
  const prevPending = useRef(hasPendingApproval);
  useEffect(() => {
    if ((started && !prevStarted.current) || (hasPendingApproval && !prevPending.current)) {
      setLaneOpen(true);
    }
    prevStarted.current = started;
    prevPending.current = hasPendingApproval;
  }, [started, hasPendingApproval]);

  // One AbortController-backed "generation" per distinct combination of these
  // four (plan §8.2) — the effect's cleanup fires document.modelContext
  // aborting every tool from the PREVIOUS generation (which browsers surface as
  // a native `toolchange` event) before the next run registers the new set.
  useEffect(() => {
    return registerDynamicTools({ incidentId, role: data.role, incidentState, hasPendingApproval });
  }, [incidentId, data.role, incidentState, hasPendingApproval]);

  async function handleRoleChange(role: string) {
    await apiSetRole(role);
    refresh();
  }

  async function handleScenarioChange(scenarioId: string) {
    await switchScenario(scenarioId);
  }

  return (
    <>
      <Ground />
      <div className="relative z-10 flex h-screen overflow-hidden text-ic-text">
        <Nav section={section} onSectionChange={setSection} />
        <div className="ic-sheet relative flex min-w-0 flex-1 flex-col">
          <SeverityLeak tone={groundTone(data.incident?.severity, incidentState)} />
          <SessionBar
            sectionLabel={SECTION_LABELS[section]}
            scenarioId={data.scenarioId || undefined}
            role={data.role}
            nowMinute={data.nowMinute || undefined}
            clockMode={incidentState === "RECOVERING" ? "accelerated" : "frozen"}
            onRoleChange={handleRoleChange}
            onScenarioChange={handleScenarioChange}
          />
          {/* `--ic-lane-inset` is how anything absolutely positioned inside the
              workspace stays clear of the open drawer without being handed the
              lane's state as a prop — the evidence spotlight reads it. */}
          <div
            className="relative z-10 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_44px]"
            style={{ "--ic-lane-inset": laneOpen ? "352px" : "0px" } as CSSProperties}
          >
            <main className="flex min-h-0 min-w-0 flex-col">
              {section === "incidents" && <IncidentWorkspace data={data} refresh={refresh} />}
              {section === "services" && <ServicesPage serviceHealth={data.serviceHealth} />}
              {section === "deployments" && <DeploymentsPage deployments={data.deployments} />}
              {section === "alerts" && <AlertsPage />}
              {section === "runbooks" && <RunbooksPage />}
              {section === "activity" && <ActivityPage />}
            </main>

            {!laneOpen && (
              <AgentRail pendingCount={data.pendingApprovals.length} onOpen={() => setLaneOpen(true)} />
            )}

            {laneOpen && (
              <aside
                aria-label="Agent lane"
                className="animate-drawer-in absolute inset-y-0 right-0 z-40 w-[352px] max-w-full border-l border-ic-border bg-ic-bg-elevated shadow-float"
              >
                <AgentLane
                  pendingApprovals={data.pendingApprovals}
                  toolSurfaceContext={{ incidentId, role: data.role, incidentState, hasPendingApproval }}
                  onCollapse={() => setLaneOpen(false)}
                />
              </aside>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
