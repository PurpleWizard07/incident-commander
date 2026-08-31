export type Section = "incidents" | "services" | "deployments" | "alerts" | "runbooks" | "activity";

const SECTIONS: { key: Section; label: string }[] = [
  { key: "incidents", label: "Incidents" },
  { key: "services", label: "Services" },
  { key: "deployments", label: "Deployments" },
  { key: "alerts", label: "Alerts" },
  { key: "runbooks", label: "Runbooks" },
  { key: "activity", label: "Activity" },
];

/** Phase 9: all six nav sections are real, reachable pages. */
export function Nav({ section, onSectionChange }: { section: Section; onSectionChange: (s: Section) => void }) {
  return (
    <nav className="flex h-full flex-col gap-0.5 border-r border-ic-border bg-ic-panel p-2 text-[13px]">
      {SECTIONS.map((s) => (
        <button
          key={s.key}
          onClick={() => onSectionChange(s.key)}
          className={`rounded px-2 py-1.5 text-left ${s.key === section ? "bg-ic-panel-2 text-ic-text" : "text-ic-text-dim"}`}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}
