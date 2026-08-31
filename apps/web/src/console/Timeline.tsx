import { useState, type ReactNode } from "react";
import type { TimelineEvent, Change } from "@incident-commander/shared";

type Source = TimelineEvent["source"] | "change";
const SOURCES: Source[] = ["system", "agent", "human", "change"];

interface MergedEntry {
  at: string;
  source: Source;
  summary: string;
}

/**
 * Source colour carries the whole palette thesis in four dots: the agent is the
 * cool one, a human is warm bone, a change to the world is ember, and the system
 * recedes. Anyone who watches this list for ten seconds learns the rule without
 * being told it, and then reads the rest of the console faster.
 */
function sourceColor(source: Source): string {
  switch (source) {
    case "agent":
      return "var(--color-ic-accent)";
    case "human":
      return "var(--color-ic-text)";
    case "change":
      return "var(--color-ic-degraded)";
    default:
      return "var(--color-ic-text-faint)";
  }
}

/**
 * Change entries are pinned onto the timeline unconditionally (plan §9: "change
 * entries appear as pins on the timeline") — Phase 4 already loads them
 * ambiently, so there is nothing to gate; `get_recent_changes`'s reactive effect
 * (the region glow) draws attention to pins that are already here.
 */
function mergeChanges(events: TimelineEvent[], changes: Change[]): MergedEntry[] {
  const changeEntries: MergedEntry[] = changes.map((c) => ({
    at: c.at,
    source: "change",
    summary: `${c.type} on ${c.service ?? "platform"}: ${c.summary}`,
  }));
  return [...events, ...changeEntries].sort((a, b) => a.at.localeCompare(b.at));
}

export function Timeline({
  events,
  changes,
  composer,
}: {
  events: TimelineEvent[];
  changes: Change[];
  /**
   * The note form, docked at the bottom of this region. A note *is* a timeline
   * entry, so it belongs here rather than in a separate actions panel two
   * regions away — but it stays a prop rather than an import so the observer
   * role can pass `null` and genuinely not render the `<form toolname>` at all.
   */
  composer?: ReactNode;
}) {
  const [filter, setFilter] = useState<Set<Source>>(new Set(SOURCES));

  function toggle(s: Source) {
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next.size === 0 ? new Set(SOURCES) : next;
    });
  }

  const merged = mergeChanges(events, changes);
  const visible = [...merged].reverse().filter((e) => filter.has(e.source));

  return (
    <div className="flex h-full flex-col">
      {/* Filters as pure colour keys — the dot is the legend and the control at
          once, so this strip doubles as the timeline's legend at zero cost. */}
      <div className="flex shrink-0 items-center gap-1 px-4 pb-2">
        {SOURCES.map((s) => {
          const on = filter.has(s);
          return (
            <button
              key={s}
              onClick={() => toggle(s)}
              aria-pressed={on}
              className={`flex items-center gap-1.5 rounded-[4px] px-1.5 py-1 font-mono text-[9.5px] uppercase tracking-[0.12em] transition-all duration-150 ${
                on ? "text-ic-text-dim" : "text-ic-text-faint hover:text-ic-text-dim"
              }`}
            >
              <span
                aria-hidden="true"
                className="h-[5px] w-[5px] rounded-full transition-all duration-150"
                style={{
                  background: on ? sourceColor(s) : "transparent",
                  boxShadow: on ? `0 0 7px 0 ${sourceColor(s)}` : `inset 0 0 0 1px var(--color-ic-border-strong)`,
                }}
              />
              {s}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="px-4 py-3 font-mono text-[10.5px] text-ic-text-faint">No timeline events yet.</p>
        ) : (
          <ol className="relative pb-1">
            {/* One continuous thread down the gutter, the same device the agent
                lane uses — so "a sequence of things that happened" looks the
                same whether a human or the machine is reading it. */}
            <span aria-hidden="true" className="absolute bottom-2 left-[67px] top-2 w-px bg-ic-border/70" />
            {visible.map((e, i) => (
              <li key={i} className="ic-row group relative flex items-center gap-3 py-[5px] pl-4 pr-4">
                <span className="ic-num w-[34px] shrink-0 text-[10px] text-ic-text-faint">{e.at.slice(11, 16)}</span>
                <span className="relative z-[1] flex h-[7px] w-[7px] shrink-0 items-center justify-center">
                  <span
                    className="h-[7px] w-[7px] rounded-full ring-2 ring-ic-bg-elevated transition-shadow duration-150"
                    style={{ background: sourceColor(e.source) }}
                  />
                </span>
                <span className="truncate text-[11.5px] leading-[1.4] text-ic-text-dim" title={e.summary}>
                  {e.summary}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {composer && <div className="shrink-0 border-t border-ic-border/70 px-4 py-2.5">{composer}</div>}
    </div>
  );
}
