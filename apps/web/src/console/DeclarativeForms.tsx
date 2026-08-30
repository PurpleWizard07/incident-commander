import { useEffect, useRef, useState } from "react";
import { apiPost } from "../webmcp/apiClient.js";

const SERVICE_OPTIONS = ["frontend", "checkout", "payments", "auth", "database", "queue", "notifications"];

/**
 * Shared plumbing for both declarative-tool forms (plan §21.3): highlights
 * while an agent is actively filling the form (`toolactivated`/`toolcancel`
 * — real DOM events the browser dispatches, so they're wired via a ref and
 * addEventListener, not a React prop), and answers the agent through
 * `SubmitEvent.respondWith()` when the submit was agent-invoked rather than
 * a plain human click. `toolautosubmit` is deliberately never set — the
 * agent fills the fields, a human still has to press Submit.
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
      className={`rounded border p-2 transition-colors ${agentFilling ? "border-ic-accent" : "border-ic-border"}`}
    >
      <input type="hidden" name="incidentId" value={incidentId} />
      <textarea
        name="note"
        required
        toolparamdescription="Plain text. State findings and uncertainty explicitly."
        placeholder="Add a note to this incident's timeline..."
        rows={2}
        className="w-full resize-none rounded border border-ic-border bg-ic-panel-2 p-1.5 font-mono text-[11px] text-ic-text placeholder:text-ic-text-dim"
      />
      <button
        type="submit"
        disabled={busy}
        className="mt-1 rounded bg-ic-panel-2 px-2 py-0.5 text-[11px] font-semibold text-ic-text disabled:opacity-50"
      >
        {busy ? "…" : "Add note"}
      </button>
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
      const r = await apiPost<{ incidentId: string }>("/api/incidents", { title, severity, affectedServices, description, actorKind });
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
      className={`flex flex-col gap-1.5 rounded border p-2 transition-colors ${agentFilling ? "border-ic-accent" : "border-ic-border"}`}
    >
      <input
        name="title"
        required
        toolparamdescription="Short incident title."
        placeholder="Incident title"
        className="w-full rounded border border-ic-border bg-ic-panel-2 p-1.5 font-mono text-[11px] text-ic-text placeholder:text-ic-text-dim"
      />
      <div className="flex gap-1.5">
        <select
          name="severity"
          required
          toolparamdescription="SEV-1, SEV-2, or SEV-3."
          defaultValue=""
          className="rounded border border-ic-border bg-ic-panel-2 p-1.5 font-mono text-[11px] text-ic-text"
        >
          <option value="" disabled>
            severity
          </option>
          <option value="SEV-1">SEV-1</option>
          <option value="SEV-2">SEV-2</option>
          <option value="SEV-3">SEV-3</option>
        </select>
        <select
          name="affectedServices"
          multiple
          required
          toolparamdescription="One or more affected services."
          className="flex-1 rounded border border-ic-border bg-ic-panel-2 p-1.5 font-mono text-[11px] text-ic-text"
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
        toolparamdescription="Optional free-text description, becomes the first note."
        placeholder="Description (optional)"
        rows={2}
        className="w-full resize-none rounded border border-ic-border bg-ic-panel-2 p-1.5 font-mono text-[11px] text-ic-text placeholder:text-ic-text-dim"
      />
      <button
        type="submit"
        disabled={busy}
        className="self-start rounded bg-ic-panel-2 px-2 py-0.5 text-[11px] font-semibold text-ic-text disabled:opacity-50"
      >
        {busy ? "…" : "Create incident"}
      </button>
    </form>
  );
}
