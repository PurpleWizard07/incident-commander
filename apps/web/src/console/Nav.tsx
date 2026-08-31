import type { ComponentType, SVGProps } from "react";
import { ActivityIcon, AlertsIcon, BrandMark, DeploymentsIcon, IncidentsIcon, RunbooksIcon, ServicesIcon } from "./icons.js";
import { useToolRecords } from "./toolActivity.js";

export type Section = "incidents" | "services" | "deployments" | "alerts" | "runbooks" | "activity";

const SECTIONS: { key: Section; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { key: "incidents", label: "Incidents", Icon: IncidentsIcon },
  { key: "services", label: "Services", Icon: ServicesIcon },
  { key: "deployments", label: "Deployments", Icon: DeploymentsIcon },
  { key: "alerts", label: "Alerts", Icon: AlertsIcon },
  { key: "runbooks", label: "Runbooks", Icon: RunbooksIcon },
  { key: "activity", label: "Activity", Icon: ActivityIcon },
];

/**
 * The command rail. All six nav sections are real, reachable pages (Phase 9).
 *
 * Three deliberate departures from the 180px labelled sidebar this replaces:
 *
 *  1. It is 64px and icon-only, with the label arriving as a floating capsule
 *     on hover/focus. Six destinations do not need 180px of permanent width in
 *     a console whose actual content is a 200-row log table and a 7-node graph
 *     — that column was the single largest block of screen this app was
 *     spending on chrome.
 *  2. It sits BEHIND the application sheet, on the darker ground, rather than
 *     being another panel beside it. That one z-order decision is what makes
 *     the interface read as layered instead of as three columns.
 *  3. The active state is a lit tile plus a bone bar welded to the rail's outer
 *     edge — the indicator belongs to the rail, not to the button, so moving
 *     between sections reads as one instrument switch throwing.
 *
 * The presence dot at the bottom is the rail's one live element: it goes cool
 * blue whenever a tool call is in flight, so the agent is visible even from a
 * page that has no agent panel on it.
 */
export function Nav({ section, onSectionChange }: { section: Section; onSectionChange: (s: Section) => void }) {
  const records = useToolRecords();
  const working = records.some((r) => r.settledAt === null);

  return (
    <nav
      aria-label="Console sections"
      className="relative z-30 flex h-full w-16 shrink-0 flex-col items-center border-r border-ic-border bg-ic-bg/70"
    >
      <div className="flex h-[52px] w-full shrink-0 items-center justify-center border-b border-ic-border/70">
        <BrandMark size={23} />
      </div>

      <div className="flex w-full flex-col items-center gap-1 pt-3">
        {SECTIONS.map(({ key, label, Icon }) => {
          const active = key === section;
          return (
            <button
              key={key}
              onClick={() => onSectionChange(key)}
              aria-current={active ? "page" : undefined}
              title={label}
              className={`group relative flex h-10 w-10 items-center justify-center rounded-md transition-colors duration-150 ${
                active
                  ? "bg-ic-panel-2 text-ic-text ring-1 ring-inset ring-ic-border-strong"
                  : "text-ic-text-faint hover:bg-ic-panel/70 hover:text-ic-text-dim"
              }`}
            >
              {/* The indicator lives on the rail's edge, not on the button. */}
              <span
                aria-hidden="true"
                className={`absolute -left-[12px] top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-ic-text transition-all duration-200 ease-out ${
                  active ? "scale-y-100 opacity-100" : "scale-y-0 opacity-0"
                }`}
              />
              <Icon />
              {/* Floating label capsule — the only place blur is used above the fold,
                  and it is affordable because it renders on hover, not at first paint. */}
              <span className="ic-float pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 -translate-y-1/2 translate-x-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[11.5px] font-medium text-ic-text opacity-0 transition-[opacity,transform] duration-150 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
                {label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto flex w-full flex-col items-center gap-4 pb-4">
        <span
          className="ic-overline select-none text-[8.5px] tracking-[0.32em] text-ic-text-faint"
          style={{ writingMode: "vertical-rl" }}
        >
          WEBMCP
        </span>
        <span className="relative flex h-2 w-2 items-center justify-center" title={working ? "Agent working" : "Agent idle"}>
          {working && (
            <span
              aria-hidden="true"
              className="absolute h-2 w-2 rounded-full bg-ic-accent animate-radar"
              style={{ transformOrigin: "center" }}
            />
          )}
          <span
            className={`h-[5px] w-[5px] rounded-full transition-colors duration-300 ${
              working ? "bg-ic-accent" : "bg-ic-border-strong"
            }`}
          />
          <span className="sr-only">{working ? "Agent working" : "Agent idle"}</span>
        </span>
      </div>
    </nav>
  );
}
