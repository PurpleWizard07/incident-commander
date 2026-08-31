const ROLES = ["responder", "approver", "observer"];
const SCENARIOS = ["INC-4821", "INC-4822", "INC-4823", "INC-4824", "INC-4825"];

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
  return (
    <header className="flex h-11 shrink-0 items-center gap-4 border-b border-ic-border bg-ic-panel px-3 font-mono text-[12px]">
      <strong className="tracking-wide text-ic-text">INCIDENT COMMANDER</strong>
      <label className="flex items-center gap-1 text-ic-text-dim">
        scenario:
        <select
          value={scenarioId && SCENARIOS.includes(scenarioId) ? scenarioId : SCENARIOS[0]}
          onChange={(e) => onScenarioChange?.(e.target.value)}
          className="rounded border border-ic-border bg-ic-panel-2 px-1 py-0.5 font-mono text-[12px] text-ic-text"
        >
          {SCENARIOS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1 text-ic-text-dim">
        role:
        <select
          value={role ?? "responder"}
          onChange={(e) => onRoleChange?.(e.target.value)}
          className="rounded border border-ic-border bg-ic-panel-2 px-1 py-0.5 font-mono text-[12px] text-ic-text"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <span className="text-ic-text-dim">
        minute: <span className="text-ic-text">{nowMinute ?? "—"}</span>
      </span>
      <span className="ml-auto text-ic-text-dim">
        clock:{" "}
        <span className={clockMode === "accelerated" ? "text-ic-accent" : "text-ic-degraded"}>
          {clockMode === "accelerated" ? "ACCELERATED" : "FROZEN"}
        </span>
      </span>
    </header>
  );
}
