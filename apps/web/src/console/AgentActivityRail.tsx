import type { Approval } from "@incident-commander/shared";
import { Panel } from "./Skeleton.js";
import { useToolRecords } from "./toolActivity.js";
import { toolResultText } from "./toolResultText.js";
import { ApprovalCard } from "./ApprovalCard.js";
import { describeToolSurface, type ToolCallRecord, type ToolSurfaceContext } from "../webmcp/registerTools.js";
import { CheckIcon, CrossIcon, SpinnerIcon } from "./icons.js";

function StatusGlyph({ record }: { record: ToolCallRecord }) {
  if (record.settledAt === null) return <SpinnerIcon width={13} height={13} className="animate-spin text-ic-accent" />;
  if (record.error) return <CrossIcon width={13} height={13} className="text-ic-down" />;
  return <CheckIcon width={13} height={13} className="text-ic-healthy" />;
}

function CallEntry({ record }: { record: ToolCallRecord }) {
  const duration = record.settledAt !== null ? record.settledAt - record.startedAt : null;
  return (
    <div className="animate-fade-in border-b border-ic-border/70 px-3 py-2.5 font-mono text-[11px] transition-colors duration-150 hover:bg-ic-panel-2/40">
      <div className="flex items-center gap-1.5">
        <StatusGlyph record={record} />
        <strong className="text-ic-text">{record.tool}</strong>
        {duration !== null && <span className="ml-auto tabular-nums text-ic-text-faint">{duration}ms</span>}
      </div>
      {/* `reason` is untrusted model output — plain text only, never markup (plan §9.1). */}
      {record.reason && <p className="mt-1 pl-[19px] text-ic-text-dim">{record.reason}</p>}
      {record.error ? (
        <p className="mt-1 pl-[19px] text-ic-down">{record.error}</p>
      ) : record.settledAt !== null ? (
        <p className="mt-1 max-h-16 overflow-hidden pl-[19px] text-ic-text-faint">{toolResultText(record.result)}</p>
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
    <div className="flex h-full flex-col gap-3.5 p-3.5">
      <Panel title="AGENT ACTIVITY" className="h-[420px] shrink-0">
        {records.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-[11px] text-ic-text-faint">
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

      <Panel title="TOOLS" className="h-24 shrink-0">
        <div className="flex h-full flex-col items-center justify-center gap-1 font-mono text-[11px] text-ic-text-dim">
          <div className="flex w-full items-center justify-around">
            <span className="flex flex-col items-center gap-0.5">
              <strong className="text-sm tabular-nums text-ic-text">{surface.read}</strong>
              <span className="text-[10px] text-ic-text-faint">read</span>
            </span>
            <span className="flex flex-col items-center gap-0.5">
              <strong className="text-sm tabular-nums text-ic-text">{surface.action}</strong>
              <span className="text-[10px] text-ic-text-faint">action</span>
            </span>
            <span className="flex flex-col items-center gap-0.5">
              <strong className="text-sm tabular-nums text-ic-text">{surface.declarative}</strong>
              <span className="text-[10px] text-ic-text-faint">declarative</span>
            </span>
            <span className="flex flex-col items-center gap-0.5">
              <strong className="text-sm tabular-nums text-ic-text">{surface.approval}</strong>
              <span className="text-[10px] text-ic-text-faint">approval</span>
            </span>
          </div>
          {toolSurfaceContext.role === "observer" && <span className="mt-1 text-[10px] text-ic-degraded">observer — read-only</span>}
        </div>
      </Panel>

      <Panel title="APPROVALS" className="min-h-32 flex-1">
        {pendingApprovals.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-[11px] text-ic-text-faint">
            No pending approvals.
          </div>
        ) : (
          <div className="h-full overflow-y-auto">
            {pendingApprovals.map((a) => (
              <div key={a.id} className="animate-fade-up border-b border-ic-border/70">
                <ApprovalCard approval={a} />
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
