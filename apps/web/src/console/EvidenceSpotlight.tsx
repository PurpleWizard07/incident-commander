import { useGlowingCall } from "./toolActivity.js";
import { toolResultText } from "./toolResultText.js";

const SPOTLIGHT_HOLD_MS = 6000;

/**
 * `get_runbook` and `inspect_alert` (plan §9: "runbook opens, matched steps
 * highlighted") don't have a dedicated panel yet — Runbooks and Alerts are
 * both Phase 9 nav sections. Until then, their visible effect is this
 * overlay: it renders the exact text the agent received (no re-fetch, no
 * duplicated formatting), positioned absolutely so it never reflows the
 * workspace underneath it (plan §21.2 — "toasts and status changes overlay;
 * they never insert into flow").
 */
export function EvidenceSpotlight() {
  const runbookGlow = useGlowingCall(["get_runbook"], SPOTLIGHT_HOLD_MS);
  const alertGlow = useGlowingCall(["inspect_alert"], SPOTLIGHT_HOLD_MS);

  const active = [runbookGlow, alertGlow]
    .filter((g) => g !== null)
    .sort((a, b) => b!.record.startedAt - a!.record.startedAt)[0];

  if (!active) return null;

  const label = active.record.tool === "get_runbook" ? "RUNBOOK" : "ALERT";
  const text = active.pending ? "Looking this up…" : toolResultText(active.record.result) || active.record.error || "No result.";

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-10 w-80 max-w-[80%]">
      <div className="pointer-events-auto rounded border border-ic-accent bg-ic-panel shadow-lg">
        <div className="flex items-center gap-2 border-b border-ic-border px-3 py-1.5 text-xs font-semibold tracking-wide text-ic-accent">
          {active.pending && <span className="animate-spin">⟳</span>}
          {label}
        </div>
        <div className="max-h-48 overflow-y-auto whitespace-pre-wrap px-3 py-2 font-mono text-[11px] text-ic-text">
          {text}
        </div>
      </div>
    </div>
  );
}
