# How this console uses WebMCP

## Tool surface

**21 imperative tools + 2 declarative forms — 23 distinct tools, all registered through
`document.modelContext`.**

| Group | Tools |
|---|---|
| Investigation (read-only, 12) | `get_active_incidents`, `get_incident`, `get_incident_timeline`, `get_service_health`, `get_service_dependencies`, `get_recent_deployments`, `get_recent_changes`, `query_logs`, `search_traces`, `compare_metrics`, `inspect_alert`, `get_runbook` |
| Action (6 imperative) | `assign_incident`, `resolve_incident`, `rollback_deployment`, `restart_service`, `scale_service`, `disable_feature_flag` |
| Declarative-only (2) | `add_incident_note`, `create_incident` — see below |
| Human-control (3) | `get_pending_approvals`, `request_approval`, `record_approval` |

`add_incident_note` and `create_incident` are declared as `<form toolname="…">` elements, not
`registerTool()` calls. Chrome's real implementation throws `InvalidStateError: Duplicate tool
name` if the same name is registered both ways, so these two are never in the imperative list —
found empirically while building, not assumed from the spec text (see `phase-summary.md`'s Phase 7
decisions log).

Every read-only tool carries `readOnlyHint: true`. Four also carry `untrustedContentHint: true`,
because their responses can contain free text this system did not author: `query_logs` and
`search_traces` (log messages, span error messages), `get_incident` (operator and agent notes), and
`get_pending_approvals` (the requesting agent's own stated reason and evidence). See
`docs/SECURITY.md`.

## `reason` is a required parameter on every read-only tool

All 13 read-only tools (the 12 investigation tools plus `get_pending_approvals`) require a `reason`
string: one sentence saying what the agent is trying to establish with the call. The console renders
it live under that call in the agent lane, which is what makes the lane an investigation the human
can follow rather than a list of tool names scrolling past.

It is required rather than optional on purpose, and the reason is a real finding rather than a
principle. It was optional until 2026-09-02, and the eval harness's hand-written schema mirror had
silently omitted it from every tool but `request_approval` — so across 290 logged tool calls in ten
real sessions it was never once populated, and nobody noticed, because nothing failed. That is not
evidence that models skip it; it is evidence that the field the shared-context argument leans on had
never been exercised at all. Requiring it removes the question. Full account in
[`evals/RESULTS.md`](../evals/RESULTS.md).

The action tools are deliberately exempt. `create_incident` and `add_incident_note` reach the agent
as `<form toolname>` elements that a *human* also fills in by hand, and a mandatory rationale field
would make the human's form worse to serve the agent's narrative. The gated remediation tools carry
their reasoning in the approval request instead, where a person actually reads it before deciding.

## Why declarative forms for these two, and not the rest

The Lighthouse Agentic Browsing audit's `webmcp-form-coverage` check pointed at these two forms
before we ever decided to convert them — the console already had real `<form>` elements for "add a
note" and "create an incident," and an agent filling out visible UI is a better match for those
specific actions than a hidden imperative call would be: a human genuinely benefits from watching
what the agent is about to write before it lands. Every other action (rollback, restart, scale,
disable-flag) stays imperative — the approval flow, not the form itself, is what a human should be
watching there.

```html
<form toolname="add_incident_note"
      tooldescription="Append a timestamped note to an incident timeline. Use to record
                       findings, uncertainty, and any action that mitigates a symptom
                       without fixing the cause."
      id="note-form">
  <input type="hidden" name="incidentId" toolparamdescription="Incident id, e.g. INC-4821">
  <textarea name="note"
            toolparamdescription="Plain text. State findings and uncertainty explicitly."></textarea>
  <button type="submit">Add note</button>
</form>
```

```js
noteForm.addEventListener('submit', async (e) => {
  const result = await saveNote(new FormData(e.target));
  if (e.agentInvoked) e.respondWith(Promise.resolve(result.summary));
});
noteForm.addEventListener('toolactivated', () => scrollNoteIntoView());
```

An agent-driven submission is styled via `:tool-form-active` so a human watching the console can
tell the form is being filled by the agent, not by them. `toolautosubmit` is deliberately **not**
set — a human still has to see the drafted content land before it becomes part of the record.

## Dynamic registration

Tools are registered and unregistered as application state changes, one `AbortController` per
registration "generation," rather than dumped statically at page load:

```ts
function useIncidentTools(incident: Incident | null, session: Session) {
  useEffect(() => {
    const ac = new AbortController();
    const register = (t: ToolDef) => document.modelContext.registerTool(t, { signal: ac.signal });

    investigationTools.forEach(register);
    if (incident && session.role !== 'observer') {
      actionToolsFor(incident).forEach(register);
      approvalToolsFor(incident).forEach(register);
    }
    return () => ac.abort();   // unregisters every tool in this generation, fires toolchange
  }, [incident?.id, incident?.state, session.role]);
}
```

What actually varies:

| Condition | Effect on the registered surface |
|---|---|
| `observer` role | Action tools never register — verified with a real `document.modelContext.getTools()` call: exactly the 12 investigation tools |
| No incident selected | Action/approval tools stay unregistered |
| Incident state is `RESOLVED` | Remediation tools unregister |
| No approval pending | `record_approval` unregisters |
| Service has no rollback target | `rollback_deployment` **still registers** and fails fast with an explanatory message, rather than silently disappearing |

The last row is deliberate: unregistering a tool is invisible to the agent, but a tool that
explains *why* it can't help teaches it something the agent can act on. We unregister for
**authority** ("you may not do this right now") and fail loudly for **feasibility** ("this specific
call cannot succeed"), and those are different situations that deserve different signals.

## The shared-context thesis

The reason this is a console and not a chat transcript: **the agent operates the same interface the
human is watching.** Every one of the 12 investigation tools has a specified visible effect —
topology nodes pulse and highlight edges, the evidence panel auto-switches tabs and scrolls to the
matching row, the metrics chart bolds the relevant series and marks the deploy that caused it, an
overlay spotlights the runbook or alert being read. The agent's evidence, its reasoning, and the
approval card it produces all render in the same place the human responder is already looking, at
the moment of the decision — not in a separate chat window describing what happened elsewhere.

A server-side MCP over the same underlying data (a Datadog- or PagerDuty-shaped tool set) would
produce a chat transcript describing an incident. This produces a console where the approval card
sits beside the graph that justifies it, the topology node that turned red, and the log line that
proves it. That's the answer to "could you remove WebMCP and leave almost the same product?" — no,
because the shared context between agent and human is the product, and it depends on the tool
calls and the console rendering the same origin's DOM.
