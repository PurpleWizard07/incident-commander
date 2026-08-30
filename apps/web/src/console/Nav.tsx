const SECTIONS = ["Incidents", "Services", "Deployments", "Alerts", "Runbooks", "Activity"] as const;

/**
 * Phase 4 builds layout only — Incidents is the one working section (the
 * hero screen). The other five render as inert labels; Phase 9 makes them
 * real pages. Do not wire click handlers here yet.
 */
export function Nav() {
  return (
    <nav className="flex h-full flex-col gap-0.5 border-r border-ic-border bg-ic-panel p-2 text-[13px]">
      {SECTIONS.map((s, i) => (
        <div
          key={s}
          className={`rounded px-2 py-1.5 ${i === 0 ? "bg-ic-panel-2 text-ic-text" : "text-ic-text-dim"}`}
        >
          {s}
        </div>
      ))}
    </nav>
  );
}
