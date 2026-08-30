import type { Approval } from "@incident-commander/shared";
import { Panel } from "./Skeleton.js";
import { useToolRecords } from "./toolActivity.js";
import { toolResultText } from "./toolResultText.js";
import { ApprovalCard } from "./ApprovalCard.js";
import { describeToolSurface, type ToolCallRecord, type ToolSurfaceContext } from "../webmcp/registerTools.js";

function icon(record: ToolCallRecord): string {
  if (record.settledAt === null) return "⟳";
  return record.error ? "✗" : "✓";
}

function CallEntry({ record }: { record: ToolCallRecord }) {
  const duration = record.settledAt !== null ? record.settledAt - record.startedAt : null;
  return (
    <div className="border-b border-ic-border px-3 py-2 font-mono text-[11px]">
      <div className="flex items-center gap-1.5">
        <span
          className={record.settledAt === null ? "animate-spin text-ic-accent" : record.error ? "text-ic-down" : "text-ic-healthy"}
        >
          {icon(record)}
        </span>
        <strong className="text-ic-text">{record.tool}</strong>
        {duration !== null && <span className="ml-auto text-ic-text-dim">{duration}ms</span>}
      </div>
      {/* `reason` is untrusted model output — plain text only, never markup (plan §9.1). */}
      {record.reason && <p className="mt-0.5 pl-4 text-ic-text-dim">{record.reason}</p>}
      {record.error ? (
        <p className="mt-0.5 pl-4 text-ic-down">{record.error}</p>
      ) : record.settledAt !== null ? (
        <p className="mt-0.5 max-h-16 overflow-hidden pl-4 text-ic-text-dim">{toolResultText(record.result)}</p>
      ) : null}
    </div>
  );
}

export function AgentActivityRail({
  pendingApprovals,
  toolSurfaceContext,
}: {
  pendingApprovals: Approval[];
  toolSurfaceContext: ToolSurfaceContext;
}) {
  const records = useToolRecords();
  const surface = describeToolSurface(toolSurfaceContext);

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <Panel title="AGENT ACTIVITY" className="h-[420px] shrink-0">
        {records.length === 0 ? (
          <div className="flex h-full items-center justify-center p-3 text-center text-[11px] text-ic-text-dim">
            No tool calls yet. Ask an agent to investigate INC-4821 in the ChatGPT in-app browser or
            Chrome with the WebMCP flag.
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            {records.map((r) => (
              <CallEntry key={r.id} record={r} />
            ))}
          </div>
        )}
      </Panel>

      <Panel title="TOOLS" className="h-20 shrink-0">
        <div className="flex h-full flex-col items-center justify-center gap-1 font-mono text-[11px] text-ic-text-dim">
          <div className="flex items-center justify-around w-full">
            <span>
              <strong className="text-ic-text">{surface.read}</strong> read
            </span>
            <span>
              <strong className="text-ic-text">{surface.action}</strong> action
            </span>
            <span>
              <strong className="text-ic-text">{surface.declarative}</strong> declarative
            </span>
            <span>
              <strong className="text-ic-text">{surface.approval}</strong> approval
            </span>
          </div>
          {toolSurfaceContext.role === "observer" && <span className="text-[10px]">observer — read-only</span>}
        </div>
      </Panel>

      <Panel title="APPROVALS" className="min-h-32 flex-1">
        {pendingApprovals.length === 0 ? (
          <div className="flex h-full items-center justify-center p-3 text-center text-[11px] text-ic-text-dim">
            No pending approvals.
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            {pendingApprovals.map((a) => (
              <div key={a.id} className="border-b border-ic-border">
                <ApprovalCard approval={a} />
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
