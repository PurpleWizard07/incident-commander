import { Panel } from "./Skeleton.js";

/**
 * Phase 4 static placeholder. The reactivity contract (every investigation
 * tool call producing a visible effect here) is Phase 5's job — this rail
 * exists now only so the layout is complete and its space is reserved,
 * per plan §21.2's CLS discipline (append below shouldn't push anything).
 */
export function AgentActivityRail() {
  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <Panel title="AGENT ACTIVITY" className="h-64 shrink-0">
        <div className="flex h-full items-center justify-center p-3 text-center text-[11px] text-ic-text-dim">
          No tool calls yet. Live activity feed arrives in Phase 5.
        </div>
      </Panel>

      <Panel title="TOOLS" className="h-20 shrink-0">
        <div className="flex h-full items-center justify-around font-mono text-[11px] text-ic-text-dim">
          <span>
            <strong className="text-ic-text">12</strong> read
          </span>
          <span>
            <strong className="text-ic-text">8</strong> action
          </span>
          <span>
            <strong className="text-ic-text">4</strong> approval
          </span>
        </div>
      </Panel>

      <Panel title="APPROVALS" className="min-h-32 flex-1">
        <div className="flex h-full items-center justify-center p-3 text-center text-[11px] text-ic-text-dim">
          No pending approvals. Approval cards arrive in Phase 6.
        </div>
      </Panel>
    </div>
  );
}
