const ROLES = ["responder", "approver", "observer"];
const SCENARIOS = ["INC-4821", "INC-4822", "INC-4823", "INC-4824", "INC-4825"];

const selectClass =
  "rounded-md border border-ic-border bg-ic-panel-2 px-1.5 py-0.5 font-mono text-[12px] text-ic-text transition-colors duration-150 hover:border-ic-border-strong focus:border-ic-accent";

/**
 * Role switcher (plan §8) and scenario picker (plan §5, Phase 8's build list)
 * — both interactive; both are what make `toolchange` and "the investigation
 * generalizes" actually observable by hand, not just asserted.
 */
export function Header({
  scenarioId,
  role,
  nowMinute,
  clockMode = "frozen",
  onRoleChange,
  onScenarioChange,
}: {
  scenarioId?: string;
  role?: string;
  nowMinute?: number;
  clockMode?: "frozen" | "accelerated";
  onRoleChange?: (role: string) => void;
  onScenarioChange?: (scenarioId: string) => void;
}) {
  const accelerated = clockMode === "accelerated";
  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-ic-border bg-ic-bg-elevated px-3.5 font-mono text-[12px] shadow-[0_1px_0_0_rgb(0_0_0/0.4)]">
      <span className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-ic-accent shadow-[0_0_10px_1px_rgb(34_211_238/0.7)]" aria-hidden="true" />
        <strong className="text-[13px] tracking-wide text-ic-text">INCIDENT COMMANDER</strong>
      </span>
      <label className="flex items-center gap-1.5 text-ic-text-dim">
        scenario:
        <select
          value={scenarioId && SCENARIOS.includes(scenarioId) ? scenarioId : SCENARIOS[0]}
          onChange={(e) => onScenarioChange?.(e.target.value)}
          className={selectClass}
        >
          {SCENARIOS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-ic-text-dim">
        role:
        <select value={role ?? "responder"} onChange={(e) => onRoleChange?.(e.target.value)} className={selectClass}>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <span className="text-ic-text-dim">
        minute: <span className="text-ic-text tabular-nums">{nowMinute ?? "—"}</span>
      </span>
      <span className="ml-auto flex items-center gap-1.5 text-ic-text-dim">
        clock:
        <span
          className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            accelerated ? "bg-ic-accent/15 text-ic-accent" : "bg-ic-degraded/15 text-ic-degraded"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${accelerated ? "bg-ic-accent animate-pulse" : "bg-ic-degraded"}`} aria-hidden="true" />
          {accelerated ? "ACCELERATED" : "FROZEN"}
        </span>
      </span>
    </header>
  );
}
