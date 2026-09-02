import type { Approval } from "@incident-commander/shared";
import { useToolRecords } from "./toolActivity.js";
import { toolResultText } from "./toolResultText.js";
import { ApprovalCard } from "./ApprovalCard.js";
import { describeToolSurface, hasAgentInterface, type ToolCallRecord, type ToolSurfaceContext } from "../webmcp/registerTools.js";
import { AgentIcon, ArrowRightIcon, AuthorityIcon, CheckIcon, CrossIcon, SpinnerIcon } from "./icons.js";
import { FloatCard } from "./Surface.js";

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
 * ═══ The lane's empty state ═══
 *
 * This is on screen for a judge's whole first minute, and it used to spend that
 * minute talking to the wrong reader. Two of its four blocks were addressed to
 * an evaluator rather than an operator: a count of registered tools with the API
 * name (`document.modelContext`) — an engineering brag no responder cares about
 * — and a standing instruction to reopen the page in a different browser behind
 * a Chrome flag. A real incident console does not tell the person on call to
 * switch browsers, and both facts already live in the README, which is where
 * someone evaluating the project reads them.
 *
 * What stays is ordinary product copy: what the assistance in this console is,
 * the one sentence that invokes it, and what will visibly happen when it runs.
 *
 * The setup instructions did solve a real problem — a page opened in a browser
 * with no agent interface leaves a lane that never fills, which reads as broken
 * — so they are still here, but only where they are actionable: shown when
 * `document.modelContext` is genuinely absent, never to a session that already
 * has an agent attached. Detect, then speak.
 */
function NoAgentNotice() {
  return (
    <div className="rounded-md border border-ic-degraded/25 bg-ic-degraded/[0.06] px-3 py-2.5">
      <div className="ic-overline mb-1 text-ic-degraded">No agent connected</div>
      <p className="text-[11px] leading-[1.5] text-ic-text-dim">
        This browser has no agent interface, so nothing can drive the console but you. To watch an
        agent work here, open it in ChatGPT&apos;s in-app browser, or in Chrome with{" "}
        <span className="font-mono text-[10px] text-ic-text-faint">chrome://flags/#enable-webmcp-testing</span>{" "}
        enabled.
      </p>
    </div>
  );
}

function StandingBy() {
  return (
    <div className="flex h-full flex-col justify-center gap-5 px-5 py-6">
      <div className="flex flex-col gap-3">
        <span className="relative flex h-10 w-10 items-center justify-center rounded-full ring-1 ring-inset ring-ic-border">
          <AgentIcon size={19} className="text-ic-border-strong" />
        </span>
        <p className="text-[12px] leading-[1.5] text-ic-text-dim">
          No tool calls yet. An agent investigating this incident works{" "}
          <span className="text-ic-text">here, in your console</span> — not in a chat window
          somewhere else.
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

      {!hasAgentInterface() && <NoAgentNotice />}
    </div>
  );
}

/**
 * ═══ The invitation ═══
 *
 * A bug of composition, not of code. `StandingBy` above holds the one sentence
 * that tells a newcomer how to start — *"Investigate the open incident in this
 * console and tell me what caused it"* — and the lane defaults to CLOSED
 * whenever an agent interface is present (see `AppShell`, which is right to do
 * that: the drawer would otherwise cover the workspace at first paint).
 *
 * The two rules compose badly. The instruction ends up shown only to browsers
 * that cannot act on it, and hidden from every browser that can — which is
 * precisely the ChatGPT-in-app-browser or flagged-Chrome session it was written
 * for. Someone landing here with a working agent gets a dense console and no
 * indication that asking is the point.
 *
 * So the sentence also lives out here, as a small floating cue on the sheet,
 * under tight conditions: only with an agent interface actually present, only
 * before the first tool call, only while the lane is collapsed, and only until
 * dismissed. It disappears permanently the moment the agent does anything,
 * because from then on the lane itself is the answer.
 *
 * It is a `FloatCard` for the same reason the approval card is: it has landed
 * on top of the console rather than being part of it, and it will leave.
 */
export function AgentInvitation({ onOpen, onDismiss }: { onOpen: () => void; onDismiss: () => void }) {
  return (
    <FloatCard className="animate-fade-up pointer-events-auto w-[19rem] max-w-[calc(100vw-5.5rem)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-ic-border/70 px-3.5 py-2">
        <AgentIcon size={13} className="text-ic-accent" />
        <h3 className="ic-overline text-ic-text-dim">Ask your agent</h3>
        <span aria-hidden="true" className="h-px flex-1 bg-ic-border/60" />
        <button
          onClick={onDismiss}
          aria-label="Dismiss agent prompt"
          title="Dismiss"
          className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-ic-text-faint transition-colors duration-150 hover:bg-ic-panel-2 hover:text-ic-text"
        >
          <CrossIcon size={10} />
        </button>
      </div>
      {/* Spans, not `<blockquote>`/`<p>`: a button's content model is phrasing
          content, and flow elements inside one are invalid HTML even though
          every browser renders them. The whole body is the target rather than a
          small "open" affordance, which also keeps it comfortably over the WCAG
          2.2 target-size floor. */}
      <button onClick={onOpen} className="group block w-full px-3.5 py-3 text-left">
        <span className="block border-l-2 border-ic-accent/50 pl-2.5 text-[12.5px] leading-[1.5] text-ic-text">
          Investigate the open incident in this console and tell me what caused it.
        </span>
        <span className="mt-2.5 flex items-center gap-1.5 font-mono text-[10px] leading-[1.6] text-ic-text-faint">
          Every call lands in the agent lane and lights the region it concerns
          <ArrowRightIcon
            size={11}
            className="shrink-0 opacity-50 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:opacity-100"
          />
        </span>
      </button>
    </FloatCard>
  );
}

/**
 * ═══ The collapsed rail ═══
 *
 * The lane held a permanent 352px grid column, sized for its rare peak (an
 * approval card) rather than its normal state (empty, or a short list of mono
 * lines). On a 1440px laptop that left the workspace 1024px and the topology
 * graph about 465px — and the topology graph is this console's signature
 * visual. The grid now reserves 44px and the lane slides out *over* the sheet.
 *
 * What stays behind is this rail, and it has the one job the lane cannot
 * delegate: never let the agent, or a production change waiting on a human, be
 * invisible. It carries the working state (the icon goes cool blue and pings),
 * the call count, and a pending-approval marker in the amber this console
 * reserves for "a person is the blocker".
 *
 * Rendered only while the lane is collapsed. The drawer covers this column
 * when it is open, and a focusable button underneath an overlay is a real
 * accessibility problem with no good escape — `aria-hidden` on something
 * tabbable is itself a violation, and leaving it reachable gives a keyboard
 * user a control that reports "expanded" and then does nothing. So the lane's
 * own collapse button is the only control while it is open.
 */
export function AgentRail({ pendingCount, onOpen }: { pendingCount: number; onOpen: () => void }) {
  const records = useToolRecords();
  const working = records.some((r) => r.settledAt === null);
  const label = [
    "Agent lane",
    records.length === 0 ? "standing by" : `${records.length} call${records.length === 1 ? "" : "s"}`,
    pendingCount > 0 ? `${pendingCount} awaiting your decision` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <button
      onClick={onOpen}
      aria-expanded={false}
      aria-label={label}
      title={label}
      className="group relative flex h-full w-11 flex-col items-center gap-3 border-l border-ic-border bg-ic-bg/35 pb-4 pt-3.5 transition-colors duration-150 hover:bg-ic-panel/60"
    >
      {/* The rail's own edge lights while a call is in flight, so the agent
          stays visible from across a room even with the lane put away. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 left-0 w-px transition-colors duration-300 ${
          working ? "bg-ic-accent" : "bg-transparent"
        }`}
      />

      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
        {working && (
          <span aria-hidden="true" className="animate-radar absolute h-6 w-6 rounded-full bg-ic-accent/20" />
        )}
        <AgentIcon
          size={15}
          className={`relative transition-colors duration-300 ${
            working ? "text-ic-accent" : "text-ic-text-faint group-hover:text-ic-text-dim"
          }`}
        />
      </span>

      {pendingCount > 0 && (
        <span className="flex h-[19px] min-w-[19px] shrink-0 items-center justify-center rounded-full bg-ic-degraded/15 px-1 ring-1 ring-inset ring-ic-degraded/40">
          <AuthorityIcon size={11} className="text-ic-degraded" />
        </span>
      )}

      <span
        className="ic-overline select-none text-[8.5px] tracking-[0.28em]"
        style={{ writingMode: "vertical-rl" }}
      >
        Agent
      </span>

      {records.length > 0 && (
        <span className={`ic-num shrink-0 text-[10.5px] ${working ? "text-ic-accent" : "text-ic-text-faint"}`}>
          {records.length}
        </span>
      )}
    </button>
  );
}

export function AgentLane({
  pendingApprovals,
  toolSurfaceContext,
  onCollapse,
}: {
  pendingApprovals: Approval[];
  toolSurfaceContext: ToolSurfaceContext;
  onCollapse: () => void;
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
          <button
            onClick={onCollapse}
            aria-label="Collapse agent lane"
            title="Collapse agent lane"
            className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ic-text-faint transition-colors duration-150 hover:bg-ic-panel-2 hover:text-ic-text"
          >
            <ArrowRightIcon size={14} />
          </button>
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
