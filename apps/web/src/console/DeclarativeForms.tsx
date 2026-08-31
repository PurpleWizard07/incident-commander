import { useEffect, useRef, useState } from "react";
import { apiPost } from "../webmcp/apiClient.js";
import { AgentIcon, PlusIcon } from "./icons.js";
import { actionButton, fieldClass, selectClass } from "./ui.js";

const SERVICE_OPTIONS = ["frontend", "checkout", "payments", "auth", "database", "queue", "notifications"];

/**
 * Shared plumbing for both declarative-tool forms (plan §21.3): highlights while
 * an agent is actively filling the form (`toolactivated`/`toolcancel` — real DOM
 * events the browser dispatches, so they are wired through a ref and
 * addEventListener, not a React prop), and answers the agent through
 * `SubmitEvent.respondWith()` when the submit was agent-invoked rather than a
 * plain human click. `toolautosubmit` is deliberately never set — the agent
 * fills the fields, a human still has to press Submit.
 */
function useDeclarativeForm(onResult: (summary: string) => void) {
  const ref = useRef<HTMLFormElement>(null);
  const [agentFilling, setAgentFilling] = useState(false);

  useEffect(() => {
    const form = ref.current;
    if (!form) return;
    const onActivated = () => setAgentFilling(true);
    const onCancel = () => setAgentFilling(false);
    form.addEventListener("toolactivated", onActivated);
    form.addEventListener("toolcancel", onCancel);
    return () => {
      form.removeEventListener("toolactivated", onActivated);
      form.removeEventListener("toolcancel", onCancel);
    };
  }, []);

  function respond(e: React.FormEvent<HTMLFormElement>, summary: string) {
    setAgentFilling(false);
    onResult(summary);
    const submitEvent = e.nativeEvent as SubmitEvent;
    if (submitEvent.agentInvoked) submitEvent.respondWith?.(Promise.resolve(summary));
  }

  return { ref, agentFilling, respond };
}

/**
 * "The agent is typing in this form right now" is the single most interesting
 * state in declarative WebMCP, and the old design expressed it as a border
 * colour change on a card that already had a border — easy to miss entirely.
 *
 * Here it is a labelled cool-blue bar that appears above the fields. It uses the
 * agent's colour and the agent's icon, consistent with the lane and the timeline
 * dots, so a human glancing over sees the same signal they have already learned
 * means "machine" everywhere else in the console.
 */
function AgentFillingBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="animate-fade-in mb-2 flex items-center gap-2 rounded-md bg-ic-accent/10 px-2 py-1.5 ring-1 ring-inset ring-ic-accent/30">
      <AgentIcon size={12} className="shrink-0 text-ic-accent" />
      <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ic-accent">
        Agent is filling this form
      </span>
    </div>
  );
}

export function AddNoteForm({ incidentId, onSubmitted }: { incidentId: string; onSubmitted: () => void }) {
  const { ref, agentFilling, respond } = useDeclarativeForm(() => onSubmitted());
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const note = String(fd.get("note") ?? "").trim();
    if (!note) return;
    setBusy(true);
    try {
      const submitEvent = e.nativeEvent as SubmitEvent;
      const actorKind = submitEvent.agentInvoked ? "agent" : "human";
      await apiPost(`/api/incidents/${encodeURIComponent(incidentId)}/notes`, { incidentId, note, actorKind });
      form.reset();
      respond(e, `Note added to ${incidentId}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      ref={ref}
      onSubmit={handleSubmit}
      toolname="add_incident_note"
      tooldescription="Append a timestamped note to an incident timeline. Use to record findings, uncertainty, and any action that mitigates a symptom without fixing the underlying cause."
      className="rounded-md border border-transparent transition-shadow duration-200"
    >
      <input type="hidden" name="incidentId" value={incidentId} />
      <AgentFillingBanner visible={agentFilling} />
      {/* A composer, not a form: one line, the action attached to its right edge. */}
      <div className="flex items-end gap-2">
        <textarea
          name="note"
          required
          aria-label="Note"
          toolparamdescription="Plain text. State findings and uncertainty explicitly."
          placeholder="Record a finding, or state what is still unexplained…"
          rows={1}
          className={fieldClass("min-h-[34px] resize-none py-2 leading-[1.35]")}
        />
        <button type="submit" disabled={busy} className={actionButton("secondary", "shrink-0")}>
          {busy ? "…" : "Add note"}
        </button>
      </div>
    </form>
  );
}

export function CreateIncidentForm({ onSubmitted }: { onSubmitted: (incidentId: string) => void }) {
  const { ref, agentFilling, respond } = useDeclarativeForm(() => {});
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const title = String(fd.get("title") ?? "").trim();
    const severity = String(fd.get("severity") ?? "");
    const affectedServices = fd.getAll("affectedServices").map(String);
    const description = String(fd.get("description") ?? "");
    if (!title || !severity || affectedServices.length === 0) return;
    setBusy(true);
    try {
      const submitEvent = e.nativeEvent as SubmitEvent;
      const actorKind = submitEvent.agentInvoked ? "agent" : "human";
      const r = await apiPost<{ incidentId: string }>("/api/incidents", {
        title,
        severity,
        affectedServices,
        description,
        actorKind,
      });
      form.reset();
      onSubmitted(r.incidentId);
      respond(e, `Created ${r.incidentId}.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      ref={ref}
      onSubmit={handleSubmit}
      toolname="create_incident"
      tooldescription="Opens a new incident with a title, severity, and affected services, and returns its id. Use when you have identified a problem that is not already tracked."
      className="flex h-full flex-col gap-2 overflow-y-auto rounded-md border border-transparent px-4 pb-3.5 transition-shadow duration-200"
    >
      <AgentFillingBanner visible={agentFilling} />
      <input
        name="title"
        required
        aria-label="Incident title"
        toolparamdescription="Short incident title."
        placeholder="What is happening?"
        className={fieldClass("font-sans text-[12.5px]")}
      />
      <div className="flex items-start gap-2">
        <span className="relative flex shrink-0 items-center">
          <select
            name="severity"
            required
            aria-label="Severity"
            toolparamdescription="SEV-1, SEV-2, or SEV-3."
            defaultValue=""
            className={selectClass("h-[36px] w-[112px] bg-ic-bg/70 shadow-[inset_0_1px_3px_0_rgb(0_0_0/0.4)]")}
          >
            <option value="" disabled>
              severity
            </option>
            <option value="SEV-1">SEV-1</option>
            <option value="SEV-2">SEV-2</option>
            <option value="SEV-3">SEV-3</option>
          </select>
        </span>
        <select
          name="affectedServices"
          multiple
          required
          aria-label="Affected services"
          toolparamdescription="One or more affected services."
          size={3}
          className={fieldClass("h-[62px] flex-1 cursor-pointer py-1 text-[10.5px] [&>option:checked]:bg-ic-panel-3 [&>option]:px-1 [&>option]:py-[1px]")}
        >
          {SERVICE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <textarea
        name="description"
        aria-label="Description"
        toolparamdescription="Optional free-text description, becomes the first note."
        placeholder="Description (optional) — becomes the first note"
        rows={1}
        className={fieldClass("min-h-[34px] resize-none leading-[1.35]")}
      />
      <button
        type="submit"
        disabled={busy}
        className={actionButton("secondary", "mt-auto flex items-center justify-center gap-1.5 self-stretch")}
      >
        <PlusIcon size={13} />
        {busy ? "…" : "Open incident"}
      </button>
    </form>
  );
}
