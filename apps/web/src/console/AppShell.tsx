import { useEffect } from "react";
import { Header } from "./Header.js";
import { Nav } from "./Nav.js";
import { IncidentWorkspace } from "./IncidentWorkspace.js";
import { AgentActivityRail } from "./AgentActivityRail.js";
import { useConsoleData } from "./useConsoleData.js";
import { ToolActivityProvider } from "./toolActivity.js";
import { EvidenceJumpProvider } from "./evidenceJump.js";
import { registerDynamicTools } from "../webmcp/registerTools.js";
import { setRole as apiSetRole } from "./api.js";

/**
 * Layout from plan §13.1: header, left nav, incident workspace, permanent
 * right rail. Column widths are fixed (not content-driven) so the grid never
 * reflows — CLS discipline applies to the shell itself, not just its panels.
 */
export function AppShell() {
  const { data, refresh } = useConsoleData();

  const incidentId = data.incident?.id ?? null;
  const incidentState = data.incident?.state ?? null;
  const hasPendingApproval = data.pendingApprovals.length > 0;

  // One AbortController-backed "generation" per distinct combination of
  // these four (plan §8.2) — the effect's cleanup fires document.modelContext
  // aborting every tool from the PREVIOUS generation (which browsers surface
  // as a native `toolchange` event) before the next run registers the new set.
  useEffect(() => {
    return registerDynamicTools({ incidentId, role: data.role, incidentState, hasPendingApproval });
  }, [incidentId, data.role, incidentState, hasPendingApproval]);

  async function handleRoleChange(role: string) {
    await apiSetRole(role);
    refresh();
  }

  return (
    <ToolActivityProvider>
      <EvidenceJumpProvider>
        <div className="flex h-screen flex-col bg-ic-bg text-ic-text">
          <Header
            scenarioId={data.scenarioId || undefined}
            role={data.role}
            nowMinute={data.nowMinute || undefined}
            clockMode={incidentState === "RECOVERING" ? "accelerated" : "frozen"}
            onRoleChange={handleRoleChange}
          />
          <div className="grid min-h-0 flex-1 grid-cols-[180px_1fr_340px]">
            <Nav />
            <main className="min-h-0 min-w-0">
              <IncidentWorkspace data={data} refresh={refresh} />
            </main>
            <aside className="min-h-0 border-l border-ic-border">
              <AgentActivityRail
                pendingApprovals={data.pendingApprovals}
                toolSurfaceContext={{ incidentId, role: data.role, incidentState, hasPendingApproval }}
              />
            </aside>
          </div>
        </div>
      </EvidenceJumpProvider>
    </ToolActivityProvider>
  );
}
