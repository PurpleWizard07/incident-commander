import type { ReactNode } from "react";

/** Fixed-dimension placeholder — same box the loaded content will occupy, so nothing shifts on arrival (plan §21.2). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-ic-panel-2 ${className ?? ""}`} />;
}

export function Panel({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex flex-col rounded border border-ic-border bg-ic-panel ${className ?? ""}`}
    >
      <header className="shrink-0 border-b border-ic-border px-3 py-1.5 text-xs font-semibold tracking-wide text-ic-text-dim">
        {title}
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}
