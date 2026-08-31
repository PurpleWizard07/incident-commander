import type { ComponentType, SVGProps } from "react";
import { ActivityIcon, AlertsIcon, DeploymentsIcon, IncidentsIcon, RunbooksIcon, ServicesIcon } from "./icons.js";

export type Section = "incidents" | "services" | "deployments" | "alerts" | "runbooks" | "activity";

const SECTIONS: { key: Section; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { key: "incidents", label: "Incidents", Icon: IncidentsIcon },
  { key: "services", label: "Services", Icon: ServicesIcon },
  { key: "deployments", label: "Deployments", Icon: DeploymentsIcon },
  { key: "alerts", label: "Alerts", Icon: AlertsIcon },
  { key: "runbooks", label: "Runbooks", Icon: RunbooksIcon },
  { key: "activity", label: "Activity", Icon: ActivityIcon },
];

/** Phase 9: all six nav sections are real, reachable pages. */
export function Nav({ section, onSectionChange }: { section: Section; onSectionChange: (s: Section) => void }) {
  return (
    <nav className="flex h-full flex-col gap-0.5 border-r border-ic-border bg-ic-bg-elevated p-2.5 text-[13px]">
      {SECTIONS.map(({ key, label, Icon }) => {
        const active = key === section;
        return (
          <button
            key={key}
            onClick={() => onSectionChange(key)}
            aria-current={active ? "page" : undefined}
            className={`group relative flex items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-2 text-left transition-all duration-150 ease-out ${
              active ? "bg-ic-panel-2 text-ic-text shadow-panel" : "text-ic-text-dim hover:bg-ic-panel/70 hover:text-ic-text"
            }`}
          >
            <span
              className={`absolute inset-y-1 left-0 w-[3px] rounded-r-full bg-ic-accent transition-transform duration-200 ease-out ${
                active ? "translate-x-0" : "-translate-x-full"
              }`}
              aria-hidden="true"
            />
            <Icon className={`shrink-0 transition-colors duration-150 ${active ? "text-ic-accent" : "text-ic-text-faint group-hover:text-ic-text-dim"}`} />
            <span className="font-medium">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
