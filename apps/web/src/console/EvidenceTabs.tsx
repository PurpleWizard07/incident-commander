import { useEffect, useRef, useState } from "react";
import { List, useListRef, type RowComponentProps } from "react-window";
import type { LogEntry, Trace, Deployment, Change, EvidenceRef } from "@incident-commander/shared";
import { useGlowingCall, type GlowingCall } from "./toolActivity.js";
import { useEvidenceJump } from "./evidenceJump.js";
import { dataRowClass, tabButton, theadRowClass, thClass, scrollBehavior } from "./ui.js";

type Tab = "logs" | "traces" | "deployments" | "changes";

const LOG_ROW_HEIGHT = 22;

function levelColor(level: LogEntry["level"]): string {
  switch (level) {
    case "FATAL":
    case "ERROR":
      return "var(--color-ic-down)";
    case "WARN":
      return "var(--color-ic-degraded)";
    default:
      return "var(--color-ic-border-strong)";
  }
}

/** Column heads for the tabular evidence views — one grammar, four tables. */
function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`${thClass} ${className}`}>{children}</th>;
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

/**
 * A log line is the smallest unit of evidence in the console and there are two
 * hundred of them, so its typography does more work than any other row: a mono
 * timestamp in a fixed gutter, severity as a colour-coded bar plus a tracked-out
 * label, the service dimmed to tertiary, and the message itself at full bone —
 * because the message is the only part you actually read.
 *
 * The row's left border is reserved system-wide for "the agent's query matched
 * this", which is why severity is a bar inside the row rather than the border
 * itself: those two signals must never compete for the same 2px.
 */
function LogRow({
  index,
  style,
  ariaAttributes,
  logs,
  highlightQuery,
}: RowComponentProps<{ logs: LogEntry[]; highlightQuery: LogQuery | null }>) {
  const l = logs[index];
  const matched = highlightQuery !== null && matchesLogQuery(l, highlightQuery);
  const color = levelColor(l.level);
  // INFO/DEBUG are the overwhelming majority of 200 lines: their level bar
  // recedes to a track mark, and only WARN and above are allowed to be loud.
  const quiet = l.level !== "WARN" && l.level !== "ERROR" && l.level !== "FATAL";
  return (
    <div
      style={style}
      {...ariaAttributes}
      className={`ic-row flex items-center gap-2.5 truncate px-3 font-mono text-[11px] ${matched ? "ic-row-hit" : ""}`}
      title={l.message}
    >
      <span className="ic-num w-[54px] shrink-0 text-[10px] text-ic-text-faint">{l.timestamp.slice(11, 19)}</span>
      <span aria-hidden="true" className="h-[13px] w-[2px] shrink-0 rounded-full" style={{ background: color }} />
      <span
        className={`w-[38px] shrink-0 text-[9px] font-medium uppercase tracking-[0.08em] ${
          quiet ? "text-ic-text-faint" : ""
        }`}
        style={quiet ? undefined : { color }}
      >
        {l.level}
      </span>
      <span className="w-[86px] shrink-0 truncate text-[10px] text-ic-text-faint">{l.service}</span>
      <span className="truncate text-ic-text-dim">{l.message}</span>
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

/** Nesting depth from `parentSpanId`, so the waterfall shows the call tree. */
function spanDepths(trace: Trace): Map<string, number> {
  const byId = new Map(trace.spans.map((s) => [s.spanId, s]));
  const depths = new Map<string, number>();
  for (const span of trace.spans) {
    let depth = 0;
    let cursor = span.parentSpanId;
    // Bounded by the span count so a malformed cycle can never hang the render.
    while (cursor && depth <= trace.spans.length) {
      depth += 1;
      cursor = byId.get(cursor)?.parentSpanId ?? null;
    }
    depths.set(span.spanId, depth);
  }
  return depths;
}

/**
 * A real waterfall: the call tree indented in a fixed left gutter, one shared
 * time track, durations right-aligned in a column.
 *
 * Two fixes to what was here. The labels used to sit to the RIGHT of their bars,
 * so they landed at seven different x-positions and the eye had to hunt for the
 * failing span instead of reading down a column. And they were built as
 * `service + "." + name` when `name` is already service-qualified, so every
 * label read "frontend.frontend.handleCheckout" and truncated to an ellipsis —
 * the span names were effectively unreadable.
 */
function TraceRow({ trace, highlightQuery, jumped }: { trace: Trace; highlightQuery: TraceQuery | null; jumped: boolean }) {
  const matched = jumped || (highlightQuery !== null && matchesTraceQuery(trace, highlightQuery));
  const failed = trace.status === "error";
  const depths = spanDepths(trace);
  return (
    <div
      id={`evidence-trace-${trace.traceId}`}
      className={`ic-row border-b border-ic-border/60 px-3 py-2.5 ${matched ? "ic-row-hit" : ""}`}
    >
      <div className="flex items-baseline gap-2.5">
        <span className="font-mono text-[10.5px] font-medium text-ic-text">{trace.traceId}</span>
        <span className="font-mono text-[10px] text-ic-text-faint">{trace.rootService}</span>
        <span
          className="ml-auto font-mono text-[9px] uppercase tracking-[0.11em]"
          style={{ color: failed ? "var(--color-ic-down)" : "var(--color-ic-healthy)" }}
        >
          {trace.status}
        </span>
        <span className="ic-num w-[52px] shrink-0 text-right text-[10.5px] text-ic-text-dim">{trace.durationMs}ms</span>
      </div>
      <div className="mt-2 flex flex-col gap-[3px]">
        {trace.spans.map((span) => {
          const left = (span.startOffsetMs / trace.durationMs) * 100;
          const width = Math.max(0.8, (span.durationMs / trace.durationMs) * 100);
          const failing = span.spanId === trace.failingSpanId;
          const color = failing
            ? "var(--color-ic-down)"
            : span.status === "error"
              ? "var(--color-ic-degraded)"
              : "rgb(179 168 152 / 0.5)";
          const depth = depths.get(span.spanId) ?? 0;
          return (
            <div key={span.spanId} className="flex items-center gap-2.5">
              <span
                className={`w-[186px] shrink-0 truncate font-mono text-[9.5px] ${
                  failing ? "font-medium text-ic-down" : "text-ic-text-faint"
                }`}
                style={{ paddingLeft: depth * 9 }}
                title={span.name}
              >
                {depth > 0 && <span className="mr-1 text-ic-text-faint">&#9492;</span>}
                {span.name}
              </span>
              <span className="relative h-[5px] flex-1 overflow-hidden rounded-full bg-ic-bg/70">
                <span
                  className="absolute inset-y-0 left-0 w-full origin-left rounded-full transition-transform duration-200"
                  style={{
                    transform: `translateX(${left}%) scaleX(${width / 100})`,
                    background: color,
                    boxShadow: failing ? "0 0 7px 0 rgb(242 97 95 / 0.6)" : undefined,
                  }}
                />
              </span>
              <span className="ic-num w-[46px] shrink-0 text-right text-[9.5px] text-ic-text-faint">
                {span.durationMs}ms
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

  // Reactivity contract (plan §9): each of these tools "opens" its evidence tab
  // and highlights what it queried for. Evidence itself is always loaded (Phase
  // 4) — the tool call only draws attention to the relevant subset.
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

  // Approval-card evidence links (plan §10.2) — a human click, not a tool call,
  // so it comes through a separate mechanism (see evidenceJump.tsx). "Clicking
  // scrolls to that evidence": switch tab, then scroll the matching row
  // (trace/deployment/change have stable ids to match against; log lines don't,
  // so a log link just opens the tab).
  const { jump } = useEvidenceJump();
  const appliedJumpNonce = useRef<number | null>(null);
  useEffect(() => {
    if (!jump || jump.nonce === appliedJumpNonce.current) return;
    appliedJumpNonce.current = jump.nonce;
    const tabForKind: Partial<Record<EvidenceRef["kind"], Tab>> = {
      log: "logs",
      trace: "traces",
      deployment: "deployments",
      change: "changes",
    };
    const target = tabForKind[jump.ref.kind];
    if (target) setTab(target);
    if (jump.ref.kind === "trace" || jump.ref.kind === "deployment" || jump.ref.kind === "change") {
      const prefix =
        jump.ref.kind === "trace"
          ? "evidence-trace-"
          : jump.ref.kind === "deployment"
            ? "evidence-deployment-"
            : "evidence-change-";
      setTimeout(
        () => document.getElementById(`${prefix}${jump.ref.id}`)?.scrollIntoView({ behavior: scrollBehavior(), block: "center" }),
        50
      );
    }
  }, [jump]);
  const jumpedTraceId = jump?.ref.kind === "trace" ? jump.ref.id : null;
  const jumpedDeploymentId = jump?.ref.kind === "deployment" ? jump.ref.id : null;
  const jumpedChangeId = jump?.ref.kind === "change" ? jump.ref.id : null;

  // A highlighted-but-off-screen match isn't really "visible" — scroll the first
  // match into view whenever a new query_logs call settles.
  const listRef = useListRef(null);
  const scrolledForCallId = useRef<string | null>(null);
  useEffect(() => {
    if (!logQuery || !logsGlow || logsGlow.record.id === scrolledForCallId.current) return;
    const index = logs.findIndex((l) => matchesLogQuery(l, logQuery));
    if (index === -1) return;
    scrolledForCallId.current = logsGlow.record.id;
    listRef.current?.scrollToRow({ index, align: "center", behavior: scrollBehavior() });
  }, [logQuery, logsGlow, logs, listRef]);

  const counts: Record<Tab, number> = {
    logs: logs.length,
    traces: traces.length,
    deployments: deployments.length,
    changes: changes.length,
  };

  return (
    <div className="flex h-full flex-col">
      {/* Underlined tabs carrying their own counts. The count is why this is a
          tab bar and not a pill row: "how much evidence of each kind is there"
          is part of reading the incident, not chrome. */}
      <div className="flex shrink-0 items-center gap-0.5 border-b border-ic-border px-2.5">
        {(["logs", "traces", "deployments", "changes"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} aria-current={tab === t ? "true" : undefined} className={tabButton(tab === t)}>
            {t}
            <span className={`ic-num ml-1.5 text-[10px] ${tab === t ? "text-ic-text-dim" : "text-ic-text-faint"}`}>
              {counts[t]}
            </span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {tab === "logs" &&
          (logs.length === 0 ? (
            <EmptyNote text={logsNote ?? "No log lines."} />
          ) : (
            /* The log view is virtualized, so its column heads live outside the
               list rather than in a <thead> — but they use the same overline
               grammar as the three real tables, so all four tabs read alike. */
            <div className="flex h-full flex-col">
              <div className="flex shrink-0 items-center gap-2.5 border-b border-ic-border/60 px-3 pb-1.5 pt-1.5">
                <span className="ic-overline w-[54px] shrink-0">Time</span>
                <span className="ic-overline w-[50px] shrink-0">Level</span>
                <span className="ic-overline w-[86px] shrink-0">Service</span>
                <span className="ic-overline">Message</span>
              </div>
              <div className="min-h-0 flex-1">
                <List
                  listRef={listRef}
                  rowComponent={LogRow}
                  rowCount={logs.length}
                  rowHeight={LOG_ROW_HEIGHT}
                  rowProps={{ logs, highlightQuery: logQuery }}
                  style={{ height: "100%" }}
                />
              </div>
            </div>
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
          <div className="h-full overflow-y-auto max-md:overflow-x-auto">
            <table className="w-full min-w-[560px] font-mono text-[11px]">
              <thead>
                <tr className={theadRowClass}>
                  <Th className="w-[124px]">When</Th>
                  <Th className="w-[104px]">Service</Th>
                  <Th className="w-[92px]">Version</Th>
                  <Th className="w-[56px]">Risk</Th>
                  <Th>Commit</Th>
                </tr>
              </thead>
              <tbody>
                {deployments.map((d) => {
                  const matched =
                    d.id === jumpedDeploymentId ||
                    (deploysGlow !== null && (!deployHighlightService || d.service === deployHighlightService));
                  return (
                    <tr
                      key={d.id}
                      id={`evidence-deployment-${d.id}`}
                      className={`${dataRowClass} ${matched ? "ic-row-hit" : ""}`}
                    >
                      <td className="ic-num px-3 py-[7px] text-[10px] text-ic-text-faint">
                        {d.deployedAt.slice(0, 16).replace("T", " ")}
                      </td>
                      <td className="px-3 py-[7px] text-ic-text">{d.service}</td>
                      <td className="px-3 py-[7px] font-medium text-ic-degraded">{d.version}</td>
                      <td className="px-3 py-[7px] text-ic-text-dim">{d.riskScore}</td>
                      <td className="max-w-[280px] truncate px-3 py-[7px] text-ic-text-faint" title={d.commitMessage}>
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
          <div className="h-full overflow-y-auto max-md:overflow-x-auto">
            <table className="w-full min-w-[560px] font-mono text-[11px]">
              <thead>
                <tr className={theadRowClass}>
                  <Th className="w-[124px]">When</Th>
                  <Th className="w-[128px]">Type</Th>
                  <Th className="w-[104px]">Service</Th>
                  <Th>Summary</Th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => {
                  const matched =
                    c.id === jumpedChangeId ||
                    (changesGlow !== null && (!changeHighlightService || c.service === changeHighlightService));
                  return (
                    <tr
                      key={c.id}
                      id={`evidence-change-${c.id}`}
                      className={`${dataRowClass} ${matched ? "ic-row-hit" : ""}`}
                    >
                      <td className="ic-num px-3 py-[7px] text-[10px] text-ic-text-faint">
                        {c.at.slice(0, 16).replace("T", " ")}
                      </td>
                      <td className="px-3 py-[7px] text-ic-degraded">{c.type}</td>
                      <td className="px-3 py-[7px] text-ic-text">{c.service ?? "—"}</td>
                      <td className="max-w-[320px] truncate px-3 py-[7px] text-ic-text-dim" title={c.summary}>
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
  return <p className="px-3 py-4 font-mono text-[10.5px] leading-relaxed text-ic-text-faint">{text}</p>;
}
