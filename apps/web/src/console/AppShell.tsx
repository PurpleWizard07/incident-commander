import { useEffect, useState } from "react";
import { SessionBar } from "./Masthead.js";
import { Nav, type Section } from "./Nav.js";
import { Ground, SeverityLeak, type GroundTone } from "./Surface.js";
import { IncidentWorkspace } from "./IncidentWorkspace.js";
import { ServicesPage, DeploymentsPage, AlertsPage, RunbooksPage, ActivityPage } from "./SupportingPages.js";
import { AgentLane } from "./AgentLane.js";
import { useConsoleData } from "./useConsoleData.js";
import { ToolActivityProvider } from "./toolActivity.js";
import { EvidenceJumpProvider } from "./evidenceJump.js";
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
 */
export function AppShell() {
  const { data, refresh, switchScenario } = useConsoleData();
  const [section, setSection] = useState<Section>("incidents");

  const incidentId = data.incident?.id ?? null;
  const incidentState = data.incident?.state ?? null;
  const hasPendingApproval = data.pendingApprovals.length > 0;

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
    <ToolActivityProvider>
      <EvidenceJumpProvider>
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
            <div className="relative z-10 grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_352px]">
              <main className="flex min-h-0 min-w-0 flex-col">
                {section === "incidents" && <IncidentWorkspace data={data} refresh={refresh} />}
                {section === "services" && <ServicesPage serviceHealth={data.serviceHealth} />}
                {section === "deployments" && <DeploymentsPage deployments={data.deployments} />}
                {section === "alerts" && <AlertsPage />}
                {section === "runbooks" && <RunbooksPage />}
                {section === "activity" && <ActivityPage />}
              </main>
              <aside className="min-h-0 border-l border-ic-border bg-ic-bg/35">
                <AgentLane
                  pendingApprovals={data.pendingApprovals}
                  toolSurfaceContext={{ incidentId, role: data.role, incidentState, hasPendingApproval }}
                />
              </aside>
            </div>
          </div>
        </div>
      </EvidenceJumpProvider>
    </ToolActivityProvider>
  );
}
