import { useEffect, useRef, useState } from "react";
import { List, useListRef, type RowComponentProps } from "react-window";
import type { LogEntry, Trace, Deployment, Change, EvidenceRef } from "@incident-commander/shared";
import { useGlowingCall, type GlowingCall } from "./toolActivity.js";
import { useEvidenceJump } from "./evidenceJump.js";
import { pillToggle, scrollBehavior } from "./ui.js";

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

interface LogQuery {
  service?: string;
  level?: string;
  contains?: string;
}

function matchesLogQuery(l: LogEntry, q: LogQuery): boolean {
  if (q.service && l.service !== q.service) return false;
  if (q.level && l.level !== q.level) return false;
  if (q.contains && !l.message.toLowerCase().includes(q.contains.toLowerCase())) return false;
  return true;
}

function LogRow({ index, style, ariaAttributes, logs, highlightQuery }: RowComponentProps<{ logs: LogEntry[]; highlightQuery: LogQuery | null }>) {
  const l = logs[index];
  const matched = highlightQuery !== null && matchesLogQuery(l, highlightQuery);
  return (
    <div
      style={style}
      {...ariaAttributes}
      className={`flex items-center gap-2 truncate border-l-2 px-2 font-mono text-[11px] transition-colors duration-200 ${
        matched ? "border-ic-accent bg-ic-accent/[0.06]" : "border-transparent hover:bg-ic-panel-2/60"
      }`}
      title={l.message}
    >
      <span className="shrink-0 tabular-nums text-ic-text-faint">{l.timestamp.slice(11, 19)}</span>
      <span className="w-14 shrink-0 font-semibold" style={{ color: levelColor(l.level) }}>
        {l.level}
      </span>
      <span className="w-24 shrink-0 text-ic-text-dim">{l.service}</span>
      <span className="truncate text-ic-text">{l.message}</span>
    </div>
  );
}

interface TraceQuery {
  service?: string;
  status?: string;
}

function matchesTraceQuery(t: Trace, q: TraceQuery): boolean {
  if (q.status && q.status !== "any" && t.status !== q.status) return false;
  if (q.service && !t.spans.some((s) => s.service === q.service)) return false;
  return true;
}

function TraceRow({ trace, highlightQuery, jumped }: { trace: Trace; highlightQuery: TraceQuery | null; jumped: boolean }) {
  const matched = jumped || (highlightQuery !== null && matchesTraceQuery(trace, highlightQuery));
  return (
    <div
      id={`evidence-trace-${trace.traceId}`}
      className={`border-b border-l-2 border-ic-border px-2 py-2 transition-colors duration-200 ${matched ? "border-l-ic-accent bg-ic-accent/[0.06]" : "border-l-transparent hover:bg-ic-panel-2/40"}`}
    >
      <div className="flex items-center justify-between font-mono text-[11px] text-ic-text-dim">
        <span>
          {trace.traceId} · {trace.rootService} · <span className="tabular-nums">{trace.durationMs}ms</span>
        </span>
        <span
          className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
          style={{
            color: trace.status === "error" ? "var(--color-ic-down)" : "var(--color-ic-healthy)",
            background: trace.status === "error" ? "rgb(251 113 133 / 0.12)" : "rgb(52 211 153 / 0.12)",
          }}
        >
          {trace.status}
        </span>
      </div>
      <div className="relative mt-1.5 h-full">
        {trace.spans.map((span) => {
          const left = (span.startOffsetMs / trace.durationMs) * 100;
          const width = Math.max(1, (span.durationMs / trace.durationMs) * 100);
          const failing = span.spanId === trace.failingSpanId;
          return (
            <div key={span.spanId} className="flex h-4 items-center gap-1.5 text-[10px]">
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-ic-panel-2">
                <div
                  className="absolute inset-y-0 left-0 h-1.5 w-full origin-left rounded-full transition-transform duration-200"
                  style={{
                    transform: `translateX(${left}%) scaleX(${width / 100})`,
                    background: failing ? "var(--color-ic-down)" : span.status === "error" ? "var(--color-ic-degraded)" : "var(--color-ic-accent)",
                    boxShadow: failing ? "0 0 6px 0 rgb(251 113 133 / 0.7)" : undefined,
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

/** Picks whichever of this tab's tools has the most recently started call. */
function latestOf(candidates: Array<{ tab: Tab; glow: GlowingCall | null }>): Tab | null {
  const present = candidates.filter((c): c is { tab: Tab; glow: GlowingCall } => c.glow !== null);
  if (present.length === 0) return null;
  present.sort((a, b) => b.glow.record.startedAt - a.glow.record.startedAt);
  return present[0].tab;
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

  // Reactivity contract (plan §9): each of these tools "opens" its evidence
  // tab and highlights what it queried for. Evidence itself is always loaded
  // (Phase 4) — the tool call only draws attention to the relevant subset.
  const logsGlow = useGlowingCall(["query_logs"]);
  const tracesGlow = useGlowingCall(["search_traces"]);
  const deploysGlow = useGlowingCall(["get_recent_deployments"]);
  const changesGlow = useGlowingCall(["get_recent_changes"]);

  const appliedTabCallId = useRef<string | null>(null);
  useEffect(() => {
    const candidates = [
      { tab: "logs" as const, glow: logsGlow },
      { tab: "traces" as const, glow: tracesGlow },
      { tab: "deployments" as const, glow: deploysGlow },
      { tab: "changes" as const, glow: changesGlow },
    ];
    const winner = latestOf(candidates);
    const winnerGlow = candidates.find((c) => c.tab === winner)?.glow;
    if (winner && winnerGlow && winnerGlow.record.id !== appliedTabCallId.current) {
      appliedTabCallId.current = winnerGlow.record.id;
      setTab(winner);
    }
  }, [logsGlow, tracesGlow, deploysGlow, changesGlow]);

  const logQuery: LogQuery | null = logsGlow ? (logsGlow.record.args as LogQuery) : null;
  const traceQuery: TraceQuery | null = tracesGlow ? (tracesGlow.record.args as TraceQuery) : null;
  const deployHighlightService = deploysGlow?.record.args.service as string | undefined;
  const changeHighlightService = changesGlow?.record.args.service as string | undefined;

  // Approval-card evidence links (plan §10.2) — a human click, not a tool
  // call, so it comes through a separate mechanism (see evidenceJump.tsx).
  // "Clicking scrolls to that evidence": switch tab, then scroll the
  // matching row (trace/deployment/change have stable ids to match against;
  // log lines don't, so a log link just opens the tab).
  const { jump } = useEvidenceJump();
  const appliedJumpNonce = useRef<number | null>(null);
  useEffect(() => {
    if (!jump || jump.nonce === appliedJumpNonce.current) return;
    appliedJumpNonce.current = jump.nonce;
    const tabForKind: Partial<Record<EvidenceRef["kind"], Tab>> = { log: "logs", trace: "traces", deployment: "deployments", change: "changes" };
    const target = tabForKind[jump.ref.kind];
    if (target) setTab(target);
    if (jump.ref.kind === "trace" || jump.ref.kind === "deployment" || jump.ref.kind === "change") {
      const prefix = jump.ref.kind === "trace" ? "evidence-trace-" : jump.ref.kind === "deployment" ? "evidence-deployment-" : "evidence-change-";
      setTimeout(() => document.getElementById(`${prefix}${jump.ref.id}`)?.scrollIntoView({ behavior: scrollBehavior(), block: "center" }), 50);
    }
  }, [jump]);
  const jumpedTraceId = jump?.ref.kind === "trace" ? jump.ref.id : null;
  const jumpedDeploymentId = jump?.ref.kind === "deployment" ? jump.ref.id : null;
  const jumpedChangeId = jump?.ref.kind === "change" ? jump.ref.id : null;

  // A highlighted-but-off-screen match isn't really "visible" — scroll the
  // first match into view whenever a new query_logs call settles.
  const listRef = useListRef(null);
  const scrolledForCallId = useRef<string | null>(null);
  useEffect(() => {
    if (!logQuery || !logsGlow || logsGlow.record.id === scrolledForCallId.current) return;
    const index = logs.findIndex((l) => matchesLogQuery(l, logQuery));
    if (index === -1) return;
    scrolledForCallId.current = logsGlow.record.id;
    listRef.current?.scrollToRow({ index, align: "center", behavior: scrollBehavior() });
  }, [logQuery, logsGlow, logs, listRef]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 gap-1.5 border-b border-ic-border px-2 py-2 text-[11px]">
        {(["logs", "traces", "deployments", "changes"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={pillToggle(tab === t, "capitalize")}>
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
              listRef={listRef}
              rowComponent={LogRow}
              rowCount={logs.length}
              rowHeight={LOG_ROW_HEIGHT}
              rowProps={{ logs, highlightQuery: logQuery }}
              style={{ height: "100%" }}
            />
          ))}
        {tab === "traces" &&
          (traces.length === 0 ? (
            <EmptyNote text={tracesNote ?? "No traces."} />
          ) : (
            <div className="h-full overflow-y-auto">
              {traces.map((t) => (
                <TraceRow key={t.traceId} trace={t} highlightQuery={traceQuery} jumped={t.traceId === jumpedTraceId} />
              ))}
            </div>
          ))}
        {tab === "deployments" && (
          <div className="h-full overflow-y-auto font-mono text-[11px]">
            <table className="w-full">
              <tbody>
                {deployments.map((d) => {
                  const matched = d.id === jumpedDeploymentId || (deploysGlow !== null && (!deployHighlightService || d.service === deployHighlightService));
                  return (
                    <tr
                      key={d.id}
                      id={`evidence-deployment-${d.id}`}
                      className={`border-b border-l-2 border-ic-border transition-colors duration-200 ${matched ? "border-l-ic-accent bg-ic-accent/[0.06]" : "border-l-transparent hover:bg-ic-panel-2/40"}`}
                    >
                      <td className="px-2 py-1.5 text-ic-text-dim">{d.deployedAt.slice(0, 16).replace("T", " ")}</td>
                      <td className="px-2 py-1.5 text-ic-text">{d.service}</td>
                      <td className="px-2 py-1.5 text-ic-accent-2">{d.version}</td>
                      <td className="px-2 py-1.5 text-ic-text-dim">{d.riskScore}</td>
                      <td className="max-w-[240px] truncate px-2 py-1.5 text-ic-text-dim" title={d.commitMessage}>
                        {d.commitMessage}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {tab === "changes" && (
          <div className="h-full overflow-y-auto font-mono text-[11px]">
            <table className="w-full">
              <tbody>
                {changes.map((c) => {
                  const matched = c.id === jumpedChangeId || (changesGlow !== null && (!changeHighlightService || c.service === changeHighlightService));
                  return (
                    <tr
                      key={c.id}
                      id={`evidence-change-${c.id}`}
                      className={`border-b border-l-2 border-ic-border transition-colors duration-200 ${matched ? "border-l-ic-accent bg-ic-accent/[0.06]" : "border-l-transparent hover:bg-ic-panel-2/40"}`}
                    >
                      <td className="px-2 py-1.5 text-ic-text-dim">{c.at.slice(0, 16).replace("T", " ")}</td>
                      <td className="px-2 py-1.5 text-ic-text">{c.type}</td>
                      <td className="px-2 py-1.5 text-ic-text-dim">{c.service ?? "—"}</td>
                      <td className="max-w-[280px] truncate px-2 py-1.5 text-ic-text-dim" title={c.summary}>
                        {c.summary}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <div className="p-4 text-[11px] text-ic-text-faint">{text}</div>;
}
