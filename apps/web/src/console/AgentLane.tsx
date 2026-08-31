import type { Approval } from "@incident-commander/shared";
import { useToolRecords } from "./toolActivity.js";
import { toolResultText } from "./toolResultText.js";
import { ApprovalCard } from "./ApprovalCard.js";
import { describeToolSurface, type ToolCallRecord, type ToolSurfaceContext } from "../webmcp/registerTools.js";
import { AgentIcon, AuthorityIcon, CheckIcon, CrossIcon, SpinnerIcon } from "./icons.js";

/**
 * ═══ The agent lane ═══
 *
 * This was three stacked cards — AGENT ACTIVITY at a fixed 420px, TOOLS at 96px,
 * APPROVALS taking the rest — each with its own border, header and shadow, in a
 * column only 340px wide. Three quarters of the horizontal space went to
 * framing, and a sequence of tool calls (which is a narrative: the agent looked
 * here, then here, then proposed this) was rendered as an undifferentiated list
 * of rows.
 *
 * Now it is one lane with one thread. A continuous hairline runs down the left
 * gutter with a status node per call, so the sequence reads as a single
 * investigation rather than N events. It is also the only region of the console
 * lit in the agent's cool blue — the lane head, the connector, the pending
 * nodes — which is what makes "the machine is working over there" legible from
 * across a room, and what makes the warm masthead beside it unmistakably the
 * human's half of the screen.
 */

function StatusNode({ record }: { record: ToolCallRecord }) {
  if (record.settledAt === null) {
    return (
      <span className="relative flex h-[18px] w-[18px] items-center justify-center">
        <span aria-hidden="true" className="absolute h-[18px] w-[18px] rounded-full bg-ic-accent/25 animate-radar" />
        <SpinnerIcon size={13} className="relative animate-spin text-ic-accent" />
      </span>
    );
  }
  if (record.error) {
    return (
      <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ic-down/12 ring-1 ring-inset ring-ic-down/35">
        <CrossIcon size={10} className="text-ic-down" />
      </span>
    );
  }
  return (
    <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-ic-panel-2 ring-1 ring-inset ring-ic-border-strong">
      <CheckIcon size={10} className="text-ic-healthy" />
    </span>
  );
}

function CallEntry({ record, last }: { record: ToolCallRecord; last: boolean }) {
  const duration = record.settledAt !== null ? record.settledAt - record.startedAt : null;
  const pending = record.settledAt === null;
  return (
    <li className="animate-fade-in relative flex gap-3 pl-4 pr-4">
      {/* The thread. Drawn per-entry rather than once behind the list so it
          stops exactly at the newest call instead of trailing into empty space. */}
      {!last && (
        <span
          aria-hidden="true"
          className={`absolute left-[calc(1rem+8px)] top-[26px] bottom-0 w-px ${pending ? "bg-ic-accent/40" : "bg-ic-border"}`}
        />
      )}
      <span className="relative z-[1] shrink-0 pt-1.5">
        <StatusNode record={record} />
      </span>
      <div className="min-w-0 flex-1 border-b border-ic-border/50 pb-3 pt-1">
        <div className="flex items-baseline gap-2">
          <span className={`truncate font-mono text-[11.5px] font-medium ${pending ? "text-ic-accent" : "text-ic-text"}`}>
            {record.tool}
          </span>
          {duration !== null && <span className="ic-num ml-auto shrink-0 text-[10px] text-ic-text-faint">{duration}ms</span>}
        </div>
        {/* `reason` is untrusted model output — plain text only, never markup (plan §9.1). */}
        {record.reason && <p className="mt-1.5 text-[11.5px] leading-[1.45] text-ic-text-dim">{record.reason}</p>}
        {record.error ? (
          <p className="mt-1.5 font-mono text-[10.5px] leading-relaxed text-ic-down">{record.error}</p>
        ) : record.settledAt !== null ? (
          <p className="mt-1.5 line-clamp-3 font-mono text-[10.5px] leading-[1.5] text-ic-text-faint">
            {toolResultText(record.result)}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The live tool surface (plan §8): how many tools the agent can currently see,
 * which changes with role, incident state and whether an approval is pending.
 * Same four numbers as before, now in the vitals grammar — bare numerals over
 * tracked-out captions, divided by hairlines — so the console has one way of
 * presenting a figure instead of a different one per panel.
 */
function SurfaceMeter({ context }: { context: ToolSurfaceContext }) {
  const surface = describeToolSurface(context);
  const cells: [string, number][] = [
    ["read", surface.read],
    ["action", surface.action],
    ["form", surface.declarative],
    ["approval", surface.approval],
  ];
  return (
    <div className="shrink-0 border-t border-ic-border">
      <div className="flex items-center gap-2.5 px-4 pb-1.5 pt-3">
        <h3 className="ic-overline">Tool surface</h3>
        <span aria-hidden="true" className="h-px flex-1 bg-ic-border/80" />
        {context.role === "observer" && (
          <span className="font-mono text-[9.5px] uppercase tracking-[0.11em] text-ic-degraded">read-only</span>
        )}
      </div>
      <div className="flex items-stretch px-2 pb-3">
        {cells.map(([label, n], i) => (
          <div
            key={label}
            className={`flex flex-1 flex-col items-center gap-1 py-1 ${i > 0 ? "border-l border-ic-border/60" : ""}`}
          >
            <span className={`ic-num text-[17px] ${n === 0 ? "text-ic-text-faint" : "text-ic-text"}`}>{n}</span>
            <span className="ic-overline text-[8.5px]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The lane's empty state is the first thing anyone opening this console sees,
 * and it stays on screen until an agent connects — which, for someone evaluating
 * the project, may be the whole first minute. It was 900px of void with one
 * centred sentence in it.
 *
 * It now does the job that space should do: says what the surface is, shows the
 * literal sentence that will make the console come alive, and states what will
 * happen when it does. Same voice and same grammar as the rest of the interface
 * — an overline, a rule, mono body — so it reads as part of the instrument
 * rather than as onboarding bolted on.
 */
function StandingBy() {
  return (
    <div className="flex h-full flex-col justify-center gap-5 px-5 py-6">
      <div className="flex flex-col gap-3">
        <span className="relative flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-inset ring-ic-border">
          <AgentIcon size={19} className="text-ic-border-strong" />
        </span>
        <p className="font-mono text-[10.5px] leading-relaxed text-ic-text-faint">
          No tool calls yet. This page publishes{" "}
          <span className="text-ic-text-dim">23 WebMCP tools</span> on{" "}
          <span className="text-ic-text-dim">document.modelContext</span>.
        </p>
      </div>

      <div className="flex items-center gap-2.5">
        <span className="ic-overline">Try asking</span>
        <span aria-hidden="true" className="h-px flex-1 bg-ic-border/80" />
      </div>

      {/* The one quoted line that turns this console on. Set as a pull-quote
          against a bone rule so it reads as speech, not as a code sample. */}
      <blockquote className="border-l-2 border-ic-text-faint/40 pl-3 text-[12.5px] leading-[1.5] text-ic-text-dim">
        Investigate the open incident in this console and tell me what caused it.
      </blockquote>

      <p className="font-mono text-[10px] leading-[1.65] text-ic-text-faint">
        Every call appears in this lane as it happens, and lights the region of
        the console it concerns — the topology node it queried, the log line it
        matched, the deploy it correlated against.
      </p>

      <p className="font-mono text-[9.5px] leading-[1.6] text-ic-text-faint">
        Open this URL in ChatGPT&apos;s in-app browser, or in Chrome with{" "}
        <span className="text-ic-text-faint">chrome://flags/#enable-webmcp-testing</span> enabled.
      </p>
    </div>
  );
}

export function AgentLane({
  pendingApprovals,
  toolSurfaceContext,
}: {
  pendingApprovals: Approval[];
  toolSurfaceContext: ToolSurfaceContext;
}) {
  const records = useToolRecords();
  const working = records.some((r) => r.settledAt === null);

  return (
    <div className="flex h-full flex-col">
      <div className="relative shrink-0 overflow-hidden border-b border-ic-border px-4 py-[13px]">
        <div className="flex items-center gap-2.5">
          <AgentIcon size={15} className={working ? "text-ic-accent" : "text-ic-text-faint"} />
          <h2 className={`ic-overline ${working ? "text-ic-accent" : "text-ic-text-dim"}`}>Agent</h2>
          <span className="ml-auto font-mono text-[10px] text-ic-text-faint">
            {records.length === 0 ? "standing by" : `${records.length} call${records.length === 1 ? "" : "s"}`}
          </span>
        </div>
        {/* A light travelling the head's bottom hairline while a call is open. */}
        {working && (
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px overflow-hidden">
            <span className="animate-sweep block h-px w-1/3 bg-gradient-to-r from-transparent via-ic-accent to-transparent" />
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {records.length === 0 ? (
          <StandingBy />
        ) : (
          <ul className="pt-3">
            {records.map((r, i) => (
              <CallEntry key={r.id} record={r} last={i === records.length - 1} />
            ))}
          </ul>
        )}
      </div>

      <SurfaceMeter context={toolSurfaceContext} />

      {/* ── Approvals ──────────────────────────────────────────────────────
          The one thing in this console that gets real elevation, blur and a
          border, because it is the one thing that has genuinely landed on top
          of everything else and is blocking: a production change waiting on a
          human. It arrives after first paint, so the animation and the
          backdrop-filter cost nothing on a cold load. */}
      {pendingApprovals.length > 0 && (
        <div className="relative z-20 max-h-[62%] shrink-0 overflow-y-auto px-3 pb-3">
          <span
            aria-hidden="true"
            className="pointer-events-none sticky top-0 -mt-1 block h-6 bg-gradient-to-b from-ic-bg via-ic-bg/70 to-transparent"
          />
          <div className="flex items-center gap-2 pb-2">
            <AuthorityIcon size={13} className="text-ic-degraded" />
            <h3 className="ic-overline text-ic-degraded">
              Awaiting your decision · {pendingApprovals.length}
            </h3>
          </div>
          <div className="flex flex-col gap-3">
            {pendingApprovals.map((a) => (
              <ApprovalCard key={a.id} approval={a} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
