import type { ReactNode } from "react";
import { glowClass } from "./ui.js";

/** Fixed-dimension placeholder — same box the loaded content will occupy, so nothing shifts on arrival (plan §21.2). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gradient-to-br from-ic-panel-2 to-ic-panel-3/60 ${className ?? ""}`}
    />
  );
}

/**
 * `glow` is the panel-level half of the reactivity contract (plan §9): which
 * section the agent's most recent call concerns. `"pending"` breathes while
 * the call is in flight; `"settled"` holds a steady glow for the hold window
 * after it returns — "nothing appears finished early."
 *
 * Deliberately no mount animation here: every Panel that's visible on first
 * paint uses this component, and an entrance animation across all of them
 * simultaneously measurably delays Lighthouse's Speed Index (the page isn't
 * "visually complete" until the animations finish) for no real user benefit
 * on a cold load — confirmed by a real before/after Lighthouse run (0.99 →
 * 0.93 performance with it, back to 0.99 without). Reserved for content that
 * genuinely arrives later during a session (ApprovalCard entries, activity
 * rail call entries), where it has no cold-load cost.
 */
export function Panel({
  title,
  className,
  glow,
  accessory,
  children,
}: {
  title: string;
  className?: string;
  glow?: "pending" | "settled" | null;
  accessory?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex flex-col overflow-hidden rounded-xl border bg-gradient-to-b from-ic-panel to-ic-panel/70 shadow-panel transition-[border-color,box-shadow] duration-300 ${glowClass(glow)} ${className ?? ""}`}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-ic-border/80 px-3 py-2">
        <span className="h-1 w-1 shrink-0 rounded-full bg-ic-text-faint" aria-hidden="true" />
        <span className="text-[11px] font-semibold tracking-[0.08em] text-ic-text-dim">{title}</span>
        {accessory && <span className="ml-auto flex items-center gap-1.5">{accessory}</span>}
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}
