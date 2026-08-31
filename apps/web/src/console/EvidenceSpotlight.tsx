import { useGlowingCall } from "./toolActivity.js";
import { toolResultText } from "./toolResultText.js";
import { FloatCard } from "./Surface.js";
import { AlertsIcon, RunbooksIcon, SpinnerIcon } from "./icons.js";

const SPOTLIGHT_HOLD_MS = 6000;

/**
 * `get_runbook` and `inspect_alert` (plan §9: "runbook opens, matched steps
 * highlighted") have no dedicated region in the incident workspace — Runbooks
 * and Alerts are both their own nav sections. Their visible effect here is this
 * overlay: it renders the exact text the agent received, with no re-fetch and no
 * duplicated formatting, positioned absolutely so it never reflows the workspace
 * underneath (plan §21.2 — "toasts and status changes overlay; they never insert
 * into flow").
 *
 * It is a `FloatCard` for the same reason an approval is: it has genuinely
 * landed on top of the console. Its header carries the agent's blue rather than
 * a status colour, because what it is showing you is *what the machine is
 * currently reading* — not a claim about production.
 *
 * Positioned to clear the masthead and vitals strip and land beside the signal
 * region. Covering the masthead (as it first did) hid the one element that
 * anchors the whole screen, to show something transient.
 */
export function EvidenceSpotlight() {
  const runbookGlow = useGlowingCall(["get_runbook"], SPOTLIGHT_HOLD_MS);
  const alertGlow = useGlowingCall(["inspect_alert"], SPOTLIGHT_HOLD_MS);

  const active = [runbookGlow, alertGlow]
    .filter((g) => g !== null)
    .sort((a, b) => b!.record.startedAt - a!.record.startedAt)[0];

  if (!active) return null;

  const isRunbook = active.record.tool === "get_runbook";
  const label = isRunbook ? "Runbook" : "Alert";
  const text = active.pending
    ? "Looking this up…"
    : toolResultText(active.record.result) || active.record.error || "No result.";

  return (
    <div
      key={active.record.id}
      // Right-anchored, but offset past the agent lane when it is open —
      // otherwise the overlay showing what the agent is reading renders
      // underneath the panel showing that it is reading.
      style={{ right: "calc(1.25rem + var(--ic-lane-inset, 0px))" }}
      className="pointer-events-none absolute top-[186px] z-30 w-[26rem] max-w-[85%] transition-[right] duration-200 ease-out"
    >
      <FloatCard className="animate-fade-up pointer-events-auto overflow-hidden" glow="settled">
        <div className="flex items-center gap-2.5 border-b border-ic-border/70 bg-ic-accent/[0.07] px-4 py-2.5">
          {isRunbook ? (
            <RunbooksIcon size={13} className="text-ic-accent" />
          ) : (
            <AlertsIcon size={13} className="text-ic-accent" />
          )}
          <h4 className="ic-overline text-ic-accent">{label}</h4>
          <span aria-hidden="true" className="h-px flex-1 bg-ic-accent/20" />
          {active.pending && <SpinnerIcon size={12} className="animate-spin text-ic-accent" />}
          <span className="font-mono text-[9px] uppercase tracking-[0.11em] text-ic-accent">agent is reading</span>
        </div>
        <div className="max-h-72 overflow-y-auto whitespace-pre-wrap px-4 py-3 font-mono text-[10.5px] leading-[1.6] text-ic-text-dim">
          {text}
        </div>
      </FloatCard>
    </div>
  );
}
