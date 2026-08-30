import { Header } from "./Header.js";
import { Nav } from "./Nav.js";
import { IncidentWorkspace } from "./IncidentWorkspace.js";
import { AgentActivityRail } from "./AgentActivityRail.js";
import { useConsoleData } from "./useConsoleData.js";
import { ToolActivityProvider } from "./toolActivity.js";
import { EvidenceJumpProvider } from "./evidenceJump.js";

/**
 * Layout from plan §13.1: header, left nav, incident workspace, permanent
 * right rail. Column widths are fixed (not content-driven) so the grid never
 * reflows — CLS discipline applies to the shell itself, not just its panels.
 */
export function AppShell() {
  const data = useConsoleData();

  return (
    <ToolActivityProvider>
      <EvidenceJumpProvider>
        <div className="flex h-screen flex-col bg-ic-bg text-ic-text">
          <Header scenarioId={data.scenarioId || undefined} role={data.role} nowMinute={data.nowMinute || undefined} />
          <div className="grid min-h-0 flex-1 grid-cols-[180px_1fr_340px]">
            <Nav />
            <main className="min-h-0 min-w-0">
              <IncidentWorkspace data={data} />
            </main>
            <aside className="min-h-0 border-l border-ic-border">
              <AgentActivityRail pendingApprovals={data.pendingApprovals} />
            </aside>
          </div>
        </div>
      </EvidenceJumpProvider>
    </ToolActivityProvider>
  );
}
