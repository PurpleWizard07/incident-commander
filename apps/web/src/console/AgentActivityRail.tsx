import { Panel } from "./Skeleton.js";
import { useToolRecords } from "./toolActivity.js";
import { toolResultText } from "./toolResultText.js";
import type { ToolCallRecord } from "../webmcp/registerTools.js";

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

export function AgentActivityRail() {
  const records = useToolRecords();

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
