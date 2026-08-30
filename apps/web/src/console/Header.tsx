/**
 * Scenario/role/seed are shown as read-only facts for Phase 4 — the scenario
 * picker and role switcher (plan §13.2) become interactive in Phase 7/8, once
 * there's more than one scenario and the role actually changes the registered
 * tool surface. Showing them now, inert, keeps the layout from §13.1 complete.
 */
export function Header({
  scenarioId,
  role,
  nowMinute,
}: {
  scenarioId?: string;
  role?: string;
  nowMinute?: number;
}) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-4 border-b border-ic-border bg-ic-panel px-3 font-mono text-[12px]">
      <strong className="tracking-wide text-ic-text">INCIDENT COMMANDER</strong>
      <span className="text-ic-text-dim">
        scenario: <span className="text-ic-text">{scenarioId ?? "—"}</span>
      </span>
      <span className="text-ic-text-dim">
        role: <span className="text-ic-text">{role ?? "—"}</span>
      </span>
      <span className="text-ic-text-dim">
        minute: <span className="text-ic-text">{nowMinute ?? "—"}</span>
      </span>
      <span className="ml-auto text-ic-text-dim">
        clock: <span className="text-ic-degraded">FROZEN</span>
      </span>
    </header>
  );
}
