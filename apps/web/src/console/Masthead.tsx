import type { ReactNode } from "react";
import type { Incident } from "@incident-commander/shared";
import { ChevronIcon, ClockIcon } from "./icons.js";
import { badge, segment, selectClass, type BadgeTone } from "./ui.js";

const ROLES = ["observer", "responder", "approver"];
const SCENARIOS = ["INC-4821", "INC-4822", "INC-4823", "INC-4824", "INC-4825"];

/**
 * ═══ The session bar ═══
 *
 * What this replaces was, honestly, a debug bar: `scenario:` and `role:` in
 * lowercase beside two unstyled native `<select>` elements and a bare
 * `minute: —`. It read as instrumentation left in by accident, and it was the
 * first thing anyone saw.
 *
 * Same three controls, same functionality — the role switcher and scenario
 * picker are exactly what make `toolchange` and "the investigation
 * generalizes" observable by hand (plan §8, §5) — but now they are designed
 * instruments: role is a segmented switch with a sliding bone indicator, the
 * clock is a live chip, and the whole bar is 52px so its bottom hairline lines
 * up with the command rail's brand cell and runs unbroken across the top of
 * the screen.
 */
export function SessionBar({
  sectionLabel,
  scenarioId,
  role,
  nowMinute,
  clockMode = "frozen",
  onRoleChange,
  onScenarioChange,
}: {
  sectionLabel: string;
  scenarioId?: string;
  role?: string;
  nowMinute?: number;
  clockMode?: "frozen" | "accelerated";
  onRoleChange?: (role: string) => void;
  onScenarioChange?: (scenarioId: string) => void;
}) {
  const accelerated = clockMode === "accelerated";
  const activeRole = role ?? "responder";
  const roleIndex = Math.max(0, ROLES.indexOf(activeRole));

  return (
    <header className="relative z-10 flex h-[52px] shrink-0 items-center gap-4 border-b border-ic-border px-5">
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="ic-overline text-ic-text-dim">Incident Commander</span>
        <span aria-hidden="true" className="h-3 w-px bg-ic-border-strong" />
        <span className="truncate text-[12.5px] font-medium tracking-[-0.01em] text-ic-text">{sectionLabel}</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="ic-overline">Scenario</span>
          <span className="relative flex items-center">
            <select
              value={scenarioId && SCENARIOS.includes(scenarioId) ? scenarioId : SCENARIOS[0]}
              onChange={(e) => onScenarioChange?.(e.target.value)}
              className={selectClass()}
            >
              {SCENARIOS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <ChevronIcon size={13} className="pointer-events-none absolute right-2 text-ic-text-faint" />
          </span>
        </label>

        <span aria-hidden="true" className="h-4 w-px bg-ic-border" />

        <div className="flex items-center gap-2">
          <span className="ic-overline">Role</span>
          <div
            role="group"
            aria-label="Responder role"
            className="relative grid grid-cols-3 rounded-md border border-ic-border bg-ic-bg/60 p-[2px]"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-[2px] left-[2px] w-[calc((100%-4px)/3)] rounded-[4px] bg-ic-text transition-transform duration-250 ease-out"
              style={{ transform: `translateX(${roleIndex * 100}%)` }}
            />
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => onRoleChange?.(r)}
                aria-pressed={r === activeRole}
                className={segment(r === activeRole)}
              >
                {r.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        <span aria-hidden="true" className="h-4 w-px bg-ic-border" />

        <span
          title={accelerated ? "Simulation clock is advancing" : "Simulation clock is held"}
          className={`flex items-center gap-2 rounded-md border px-2.5 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.11em] transition-colors duration-300 ${
            accelerated
              ? "border-ic-healthy/35 bg-ic-healthy/10 text-ic-healthy"
              : "border-ic-border bg-ic-panel-2/60 text-ic-text-faint"
          }`}
        >
          <ClockIcon size={13} className={accelerated ? "animate-spin [animation-duration:3s]" : ""} />
          {accelerated ? "Live" : "Held"}
          <span aria-hidden="true" className="h-3 w-px bg-current opacity-25" />
          <span className="ic-num text-[11px] tracking-normal">{nowMinute ?? "—"}</span>
        </span>
      </div>
    </header>
  );
}

function severityTone(severity: string): BadgeTone {
  if (severity === "SEV-1") return "critical";
  if (severity === "SEV-2") return "warning";
  return "neutral";
}

const STATE_DOT: Record<string, string> = {
  OPEN: "bg-ic-down",
  INVESTIGATING: "bg-ic-degraded",
  // The one state whose blocker is a person, so it gets a person's colour.
  WAITING_FOR_APPROVAL: "bg-ic-text",
  MONITORING: "bg-ic-accent",
  RECOVERING: "bg-ic-healthy",
  RESOLVED: "bg-ic-healthy",
};

/**
 * ═══ The incident masthead ═══
 *
 * The old console's most important object — the incident itself — was a 14px
 * string in a 56px strip, sharing a line with four badges and a timestamp.
 * Nothing on the screen was primary.
 *
 * Here the title is the largest type in the application (30px display, tight
 * tracking, full bone) and it gets its own line with nothing competing. The
 * id, severity and state sit above it as small mono metadata; the timing sits
 * right-aligned as tertiary. That is the entire hierarchy device — scale and
 * position, no container — and it is why the vitals strip beneath it can also
 * be container-less without the two blurring together.
 */
export function IncidentMasthead({ incident, glowing }: { incident: Incident; glowing: boolean }) {
  return (
    <div className="relative z-10 shrink-0 px-5 pb-3.5 pt-3.5">
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-px transition-colors duration-300 ${
          glowing ? "bg-ic-accent" : "bg-transparent"
        }`}
      />
      <div className="flex items-center gap-2.5">
        <span className="font-mono text-[11px] font-medium tracking-[0.09em] text-ic-text-dim">{incident.id}</span>
        <span className={badge(severityTone(incident.severity))}>{incident.severity}</span>
        <span className={badge("neutral")}>
          <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[incident.state] ?? "bg-ic-text-faint"}`} />
          {incident.state}
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-ic-border/60" />
        <span className="font-mono text-[10.5px] text-ic-text-faint">
          opened <span className="ic-num text-ic-text-dim">{incident.openedAt.slice(11, 16)}</span>
        </span>
      </div>
      <h1 className="ic-display mt-2.5 text-[29px]">{incident.title}</h1>
      <p className="ic-meta mt-2 text-ic-text-faint">
        {incident.affectedServices.length} service{incident.affectedServices.length === 1 ? "" : "s"} affected
        <span className="mx-2 opacity-40">/</span>
        <span className="text-ic-text-dim">{incident.affectedServices.join("  ·  ")}</span>
        {incident.assignee && (
          <>
            <span className="mx-2 opacity-40">/</span>
            assigned <span className="text-ic-text-dim">{incident.assignee}</span>
          </>
        )}
      </p>
    </div>
  );
}

/**
 * The same masthead grammar for every supporting page, so a screenshot of
 * Services and a screenshot of the incident view are obviously the same
 * product: display title, mono sub-line, optional right-aligned accessory.
 */
export function PageMasthead({
  title,
  meta,
  accessory,
}: {
  title: string;
  meta: ReactNode;
  accessory?: ReactNode;
}) {
  return (
    <div className="relative z-10 flex shrink-0 items-end gap-4 px-5 pb-4 pt-5">
      <div className="min-w-0">
        <h1 className="ic-display text-[26px]">{title}</h1>
        <p className="ic-meta mt-1.5 text-ic-text-faint">{meta}</p>
      </div>
      {accessory && <div className="ml-auto shrink-0">{accessory}</div>}
    </div>
  );
}
