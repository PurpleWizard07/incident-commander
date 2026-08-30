import type { ReactNode } from "react";

/** Fixed-dimension placeholder — same box the loaded content will occupy, so nothing shifts on arrival (plan §21.2). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-ic-panel-2 ${className ?? ""}`} />;
}

/**
 * `glow` is the panel-level half of the reactivity contract (plan §9): which
 * section the agent's most recent call concerns. `"pending"` pulses while
 * the call is in flight; `"settled"` holds a steady highlight for the glow
 * window after it returns — "nothing appears finished early."
 */
export function Panel({
  title,
  className,
  glow,
  children,
}: {
  title: string;
  className?: string;
  glow?: "pending" | "settled" | null;
  children: ReactNode;
}) {
  const borderClass = glow === "pending" ? "border-ic-accent animate-pulse" : glow === "settled" ? "border-ic-accent" : "border-ic-border";
  return (
    <section
      className={`flex flex-col rounded border bg-ic-panel transition-colors duration-300 ${borderClass} ${className ?? ""}`}
    >
      <header className="shrink-0 border-b border-ic-border px-3 py-1.5 text-xs font-semibold tracking-wide text-ic-text-dim">
        {title}
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}
