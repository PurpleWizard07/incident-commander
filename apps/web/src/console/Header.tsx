const ROLES = ["responder", "approver", "observer"];

/**
 * The role switcher (plan §8, Phase 7's build list) is the only interactive
 * control here — it's what makes `toolchange` actually observable by hand.
 * Scenario/seed stay read-only facts until Phase 8 adds more than one
 * scenario to pick between.
 */
export function Header({
  scenarioId,
  role,
  nowMinute,
  clockMode = "frozen",
  onRoleChange,
}: {
  scenarioId?: string;
  role?: string;
  nowMinute?: number;
  clockMode?: "frozen" | "accelerated";
  onRoleChange?: (role: string) => void;
}) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-4 border-b border-ic-border bg-ic-panel px-3 font-mono text-[12px]">
      <strong className="tracking-wide text-ic-text">INCIDENT COMMANDER</strong>
      <span className="text-ic-text-dim">
        scenario: <span className="text-ic-text">{scenarioId ?? "—"}</span>
      </span>
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
