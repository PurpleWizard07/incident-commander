import { useState } from "react";
import { List, type RowComponentProps } from "react-window";
import type { LogEntry, Trace, Deployment, Change } from "@incident-commander/shared";

type Tab = "logs" | "traces" | "deployments" | "changes";

const LOG_ROW_HEIGHT = 24;

function levelColor(level: LogEntry["level"]): string {
  switch (level) {
    case "FATAL":
    case "ERROR":
      return "var(--color-ic-down)";
    case "WARN":
      return "var(--color-ic-degraded)";
    default:
      return "var(--color-ic-text-dim)";
  }
}

function LogRow({ index, style, ariaAttributes, logs }: RowComponentProps<{ logs: LogEntry[] }>) {
  const l = logs[index];
  return (
    <div
      style={style}
      {...ariaAttributes}
      className="flex items-center gap-2 truncate px-2 font-mono text-[11px]"
      title={l.message}
    >
      <span className="shrink-0 text-ic-text-dim">{l.timestamp.slice(11, 19)}</span>
      <span className="w-14 shrink-0 font-semibold" style={{ color: levelColor(l.level) }}>
        {l.level}
      </span>
      <span className="w-24 shrink-0 text-ic-text-dim">{l.service}</span>
      <span className="truncate">{l.message}</span>
    </div>
  );
}

function TraceRow({ trace }: { trace: Trace }) {
  return (
    <div className="border-b border-ic-border px-2 py-1.5">
      <div className="flex items-center justify-between font-mono text-[11px] text-ic-text-dim">
        <span>
          {trace.traceId} · {trace.rootService} · {trace.durationMs}ms
        </span>
        <span style={{ color: trace.status === "error" ? "var(--color-ic-down)" : "var(--color-ic-healthy)" }}>
          {trace.status}
        </span>
      </div>
      <div className="relative mt-1 h-full">
        {trace.spans.map((span) => {
          const left = (span.startOffsetMs / trace.durationMs) * 100;
          const width = Math.max(1, (span.durationMs / trace.durationMs) * 100);
          const failing = span.spanId === trace.failingSpanId;
          return (
            <div key={span.spanId} className="flex h-4 items-center gap-1 text-[10px]">
              <div className="relative h-2 flex-1 rounded bg-ic-panel-2">
                <div
                  className="absolute top-0 h-2 rounded"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    background: failing ? "var(--color-ic-down)" : span.status === "error" ? "var(--color-ic-degraded)" : "var(--color-ic-accent)",
                  }}
                />
              </div>
              <span className="w-40 shrink-0 truncate text-ic-text-dim">
                {span.service}.{span.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EvidenceTabs({
  logs,
  logsNote,
  traces,
  tracesNote,
  deployments,
  changes,
}: {
  logs: LogEntry[];
  logsNote?: string;
  traces: Trace[];
  tracesNote?: string;
  deployments: Deployment[];
  changes: Change[];
}) {
  const [tab, setTab] = useState<Tab>("logs");

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 gap-1 border-b border-ic-border px-2 py-1.5 text-[11px]">
        {(["logs", "traces", "deployments", "changes"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-2 py-0.5 capitalize ${
              tab === t ? "bg-ic-accent text-ic-bg" : "bg-ic-panel-2 text-ic-text-dim"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {tab === "logs" &&
          (logs.length === 0 ? (
            <EmptyNote text={logsNote ?? "No log lines."} />
          ) : (
            <List
              rowComponent={LogRow}
              rowCount={logs.length}
              rowHeight={LOG_ROW_HEIGHT}
              rowProps={{ logs }}
              style={{ height: "100%" }}
            />
          ))}
        {tab === "traces" &&
          (traces.length === 0 ? (
            <EmptyNote text={tracesNote ?? "No traces."} />
          ) : (
            <div className="h-full overflow-y-auto">
              {traces.map((t) => (
                <TraceRow key={t.traceId} trace={t} />
              ))}
            </div>
          ))}
        {tab === "deployments" && (
          <div className="h-full overflow-y-auto font-mono text-[11px]">
            <table className="w-full">
              <tbody>
                {deployments.map((d) => (
                  <tr key={d.id} className="border-b border-ic-border">
                    <td className="px-2 py-1 text-ic-text-dim">{d.deployedAt.slice(0, 16).replace("T", " ")}</td>
                    <td className="px-2 py-1">{d.service}</td>
                    <td className="px-2 py-1">{d.version}</td>
                    <td className="px-2 py-1 text-ic-text-dim">{d.riskScore}</td>
                    <td className="max-w-[240px] truncate px-2 py-1 text-ic-text-dim" title={d.commitMessage}>
                      {d.commitMessage}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === "changes" && (
          <div className="h-full overflow-y-auto font-mono text-[11px]">
            <table className="w-full">
              <tbody>
                {changes.map((c) => (
                  <tr key={c.id} className="border-b border-ic-border">
                    <td className="px-2 py-1 text-ic-text-dim">{c.at.slice(0, 16).replace("T", " ")}</td>
                    <td className="px-2 py-1">{c.type}</td>
                    <td className="px-2 py-1">{c.service ?? "—"}</td>
                    <td className="max-w-[280px] truncate px-2 py-1 text-ic-text-dim" title={c.summary}>
                      {c.summary}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <div className="p-3 text-[11px] text-ic-text-dim">{text}</div>;
}
