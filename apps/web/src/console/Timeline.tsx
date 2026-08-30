import { useState } from "react";
import type { TimelineEvent } from "@incident-commander/shared";

type Source = TimelineEvent["source"];
const SOURCES: Source[] = ["system", "agent", "human"];

function sourceColor(source: Source): string {
  switch (source) {
    case "agent":
      return "var(--color-ic-accent)";
    case "human":
      return "var(--color-ic-healthy)";
    default:
      return "var(--color-ic-text-dim)";
  }
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const [filter, setFilter] = useState<Set<Source>>(new Set(SOURCES));

  function toggle(s: Source) {
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next.size === 0 ? new Set(SOURCES) : next;
    });
  }

  const visible = [...events].reverse().filter((e) => filter.has(e.source));

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 gap-1 border-b border-ic-border px-2 py-1.5 text-[11px]">
        {SOURCES.map((s) => (
          <button
            key={s}
            onClick={() => toggle(s)}
            className="flex items-center gap-1 rounded px-2 py-0.5 capitalize"
            style={{
              background: filter.has(s) ? "var(--color-ic-panel-2)" : "transparent",
              color: filter.has(s) ? "var(--color-ic-text)" : "var(--color-ic-text-dim)",
            }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: sourceColor(s) }} />
            {s}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="p-3 text-[11px] text-ic-text-dim">No timeline events yet.</div>
        ) : (
          visible.map((e, i) => (
            <div key={i} className="flex h-6 items-center gap-2 border-b border-ic-border px-2 font-mono text-[11px]">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: sourceColor(e.source) }} />
              <span className="shrink-0 text-ic-text-dim">{e.at.slice(11, 16)}</span>
              <span className="truncate">{e.summary}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
