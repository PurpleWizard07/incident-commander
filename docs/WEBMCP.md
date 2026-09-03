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

That 23 is the **catalogue** — every distinct name that can be registered. The surface live at any
one moment is smaller, because registration tracks application state (see *Dynamic registration*).
On production today, a `responder` looking at an open incident with nothing awaiting a decision sees
**22**: the 20 imperative tools that context calls for, plus the 2 declarative forms.
`record_approval` is the 21st, and it appears only once an approval is actually pending.

`add_incident_note` and `create_incident` are declared as `<form toolname="…">` elements, not
`registerTool()` calls. Chrome's real implementation throws `InvalidStateError: Duplicate tool
name` if the same name is registered both ways, so these two are never in the imperative list —
found empirically while building, not assumed from the spec text (see `phase-summary.md`'s Phase 7
decisions log).

Every read-only tool carries `readOnlyHint: true`. Four also carry `untrustedContentHint: true`,
because their responses can contain free text this system did not author: `query_logs` and
`search_traces` (log messages, span error messages), `get_incident` (operator and agent notes), and
`get_pending_approvals` (the requesting agent's own stated reason and evidence). See
[`SECURITY.md`](SECURITY.md).

## Getting the tools to appear

The page carries a first-party **WebMCP origin trial token** for `https://firebro.netlify.app`, so
on Chrome 149–156 the tools register on page load with **no flag and no setup** — verified in real
Chrome 152, headless, no flags. ChatGPT's in-app browser needs nothing either. Any other browser
needs `chrome://flags/#enable-webmcp-testing`, and the console says so once in the agent lane rather
than silently presenting a lane that never fills.

One caveat worth knowing if you deploy this yourself: the token is bound to that exact origin and
carries no `isSubdomain`, so a Netlify **deploy-preview** URL is a different origin and still needs
the flag. Always check flag-free behaviour against production. (An earlier token set
`isThirdParty: true` and was silently rejected in a static `<meta>` tag — see
[`SPEC-FEEDBACK.md`](SPEC-FEEDBACK.md) §5.)

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

```tsx
// apps/web/src/console/DeclarativeForms.tsx
<form ref={ref} onSubmit={handleSubmit}
      toolname="add_incident_note"
      tooldescription="Append a timestamped note to an incident timeline. Use to record
                       findings, uncertainty, and any action that mitigates a symptom
                       without fixing the underlying cause.">
  <input type="hidden" name="incidentId" value={incidentId} />
  <AgentFillingBanner visible={agentFilling} />
  <textarea name="note" required aria-label="Note"
            toolparamdescription="Plain text. State findings and uncertainty explicitly." />
  <button type="submit">Add note</button>
</form>
```

Two things are wired to the DOM directly rather than through React props, because they're real
browser events on the form element:

```ts
form.addEventListener("toolactivated", () => setAgentFilling(true));
form.addEventListener("toolcancel", () => setAgentFilling(false));

// …and in the submit handler, answer the agent only when the agent is the one submitting:
const submitEvent = e.nativeEvent as SubmitEvent;
const actorKind = submitEvent.agentInvoked ? "agent" : "human";
if (submitEvent.agentInvoked) submitEvent.respondWith?.(Promise.resolve(summary));
```

`agentInvoked` also decides what goes in the audit log and on the timeline, so a note the agent
wrote and a note a human typed are distinguishable after the fact, not just while it happens.

"The agent is typing in this form right now" is the most interesting state declarative WebMCP has,
so it is said twice, deliberately: `AgentFillingBanner` is a labelled bar in the agent's blue above
the fields, and the browser's own `:tool-form-active` pseudo-class outlines the form
(`index.css`). A browser without declarative WebMCP simply never matches the pseudo-class — a no-op,
not a broken style. `toolautosubmit` is deliberately **not** set: the agent fills the fields, a
human still presses Submit and sees the content before it lands.

## Dynamic registration

Tools are registered and unregistered as application state changes, one `AbortController` per
registration "generation," rather than dumped statically at page load. The condition table and the
registration both read from one pure function, so the rail's "current tool surface" readout can
never drift from what is actually registered:

```ts
// apps/web/src/webmcp/registerTools.ts
export function selectRegisteredTools(ctx: ToolSurfaceContext) {
  const tools = [...INVESTIGATION_TOOLS];
  if (ctx.role === "observer") return tools;
  if (ctx.incidentId === null) return tools;

  if (ctx.incidentState !== "RESOLVED") {
    tools.push(assignIncident, resolveIncident, rollbackDeployment,
               restartService, scaleService, disableFeatureFlag);
  }
  tools.push(getPendingApprovals, requestApproval);
  if (ctx.hasPendingApproval) tools.push(recordApproval);
  return tools;
}

export function registerDynamicTools(ctx: ToolSurfaceContext): () => void {
  const controller = new AbortController();
  for (const tool of selectRegisteredTools(ctx)) {
    document.modelContext
      .registerTool({ ...tool, execute: instrument(tool) }, { signal: controller.signal })
      .catch((err) => console.warn(`[webmcp] failed to register "${tool.name}":`, err));
  }
  return () => controller.abort();   // unregisters this generation, fires toolchange
}
```

`AppShell` creates one generation per distinct `(incidentId, role, incidentState,
hasPendingApproval)` and tears the previous one down before building the next. `registerTool()`
returns a promise that can reject, so every call has a `.catch` — a name collision must surface as a
warning, never as an unhandled rejection.

What actually varies:

| Condition | Effect on the registered surface |
|---|---|
| `observer` role | Action tools never register, and the two forms are not rendered either |
| No incident selected | Action/approval tools stay unregistered |
| Incident state is `RESOLVED` | Remediation tools unregister |
| No approval pending | `record_approval` unregisters |
| Service has no rollback target | `rollback_deployment` **still registers** and fails fast with an explanatory message, rather than silently disappearing |

The last row is deliberate: unregistering a tool is invisible to the agent, but a tool that explains
*why* it can't help teaches it something the agent can act on. We unregister for **authority** ("you
may not do this right now") and fail loudly for **feasibility** ("this specific call cannot
succeed"), and those are different situations that deserve different signals.

Measured on production with real `document.modelContext.getTools()` calls (Chrome 152, no flags,
2026-09-03): `responder` **22** → switch to `observer` **12**, exactly the read-only investigation
tools and no forms → switch back **22**, no duplicate-name rejections in either direction.

## The shared-context thesis

The reason this is a console and not a chat transcript: **the agent operates the same interface the
human is watching.** Every one of the 12 investigation tools has a specified visible effect —
topology nodes pulse and highlight edges, the evidence panel auto-switches tabs and scrolls to the
matching row, the metrics chart bolds the relevant series and marks the deploy that caused it, an
overlay spotlights the runbook or alert being read. The agent's evidence, its reasoning, and the
approval card it produces all render in the same place the human responder is already looking, at
the moment of the decision — not in a separate chat window describing what happened elsewhere.

The mechanism is `src/console/toolActivity.tsx`, a React context fed by the instrumentation wrapper
in `registerTools.ts`: one record per call, updated in place from started to settled, which both the
agent lane and the relevant console panel subscribe to. It is not a rendering afterthought — it is
the reactivity contract, and it is why `reason` is required.

A server-side MCP over the same underlying data (a Datadog- or PagerDuty-shaped tool set) would
produce a chat transcript describing an incident. This produces a console where the approval card
sits beside the graph that justifies it, the topology node that turned red, and the log line that
proves it. That's the answer to "could you remove WebMCP and leave almost the same product?" — no,
because the shared context between agent and human is the product, and it depends on the tool calls
and the console rendering the same origin's DOM.
