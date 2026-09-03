# Firebro

**An incident response console where AI agents investigate production failures and humans stay in control of remediation.**

Firebro is a simulated incident-response workspace built for WebMCP.

It looks and works like an operational console: incidents, service health, dependencies, deployments, metrics, logs, traces, alerts, runbooks, timelines, and remediation controls.

The difference is that an agent can operate that same workspace through WebMCP.

The agent can investigate an outage, correlate evidence, propose a remediation, and follow the incident through recovery. Consequential actions can require explicit human approval before they are executed.

**Agent capability, human authority.**

> Firebro uses deterministic simulated infrastructure. It does not connect to or modify real production systems.

---

## The problem

During an incident, the answer is rarely sitting on one screen.

An engineer may need to check:

- which services are unhealthy
- recent deployments
- dependency failures
- logs
- traces
- metric changes
- alerts
- recent configuration changes
- runbooks
- the incident timeline

Then they still have to decide whether the evidence is strong enough to take action.

An AI agent is well suited to the investigation part of this workflow because it can move through structured evidence quickly.

But incident response is also a bad place for unrestricted automation.

A wrong rollback, restart, scale operation, or configuration change can make an outage worse.

Firebro explores the middle ground: **let the agent investigate deeply, but keep consequential decisions under human control.**

---

## Why this is a strong fit for WebMCP

A remote MCP server could expose an observability API.

That is not quite what Firebro is trying to do.

The important context already exists inside the incident console the operator has open:

- which incident is selected
- what service is being inspected
- what stage the incident is in
- which evidence is currently visible
- whether an approval is pending
- which actions are valid right now

WebMCP lets the agent work inside that same application context.

When the agent inspects something, Firebro can reflect that investigation in the normal UI. When it proposes a consequential action, the approval can appear next to the graphs, logs, traces, and deployment information supporting that decision.

The human and agent are not operating two separate systems.

They are working from the same incident.

---

## What the agent can do

Firebro exposes WebMCP tools across the full incident-response workflow.

### Investigation

The agent can inspect:

- active incidents
- incident details
- service health
- service dependencies
- recent deployments
- recent changes
- logs
- traces
- metric comparisons
- alerts
- runbooks
- incident timelines

### Incident management

The agent can also:

- create an incident
- assign an incident
- add incident notes
- inspect pending approvals
- request approval for a remediation
- resolve an incident after recovery has been verified

### Remediation

Depending on the incident, available actions can include:

- rolling back a deployment
- restarting a service
- scaling a service
- disabling a feature flag

Not every action is appropriate for every incident.

That is intentional.

---

## What people and agents can do together

The main Firebro workflow looks like this:

```text
Observe
  ↓
Investigate
  ↓
Correlate evidence
  ↓
Diagnose
  ↓
Propose remediation
  ↓
Human approval
  ↓
Remediate
  ↓
Verify recovery
```

The agent handles the expensive investigation work.

The human keeps authority over actions that can affect production.

For example, an agent may find that checkout latency started immediately after a deployment, confirm that traces point to the same service, compare metrics before and after the change, and propose a rollback.

Firebro can then present that rollback for human approval beside the evidence supporting it.

Only after the operator approves the specific action can remediation continue.

This is different from having an assistant summarize an incident in chat. The agent is participating in the operational workflow itself.

---

## Shared context

One of the main goals of Firebro was to avoid building a separate interface just for the agent.

The WebMCP tools operate on the same application state used by the console.

Agent investigations can produce visible effects in the UI:

- a service can be focused in the topology
- dependencies can be highlighted
- logs can move to the relevant evidence
- traces can be surfaced
- metric comparisons can become visible
- runbook steps can be highlighted
- approval requests can appear inside the incident workflow

This gives the operator a way to see what the agent is doing without exposing or depending on hidden chain-of-thought.

The console shows observable actions, evidence, and results.

---

## Human approval

Firebro deliberately does not treat approval as a simple boolean.

A consequential action is tied to the exact remediation being requested.

For example, approving:

```text
rollback deployment checkout-v3
```

should not authorize:

```text
restart payments
```

or any other action.

Approvals are action-specific, single-use, and enforced by the backend rather than trusted to the agent or frontend alone.

The agent can request approval.

The human provides it.

---

## The incident simulator

Firebro does not use a static set of screenshots pretending to be an outage.

It runs a deterministic incident simulation.

Each scenario has an underlying cause and a set of observable signals:

- metrics change over time
- logs are generated
- traces reflect degraded dependencies
- alerts fire
- deployments and configuration changes appear in history
- remediation changes what happens next

The underlying ground truth is intentionally **not exposed through the WebMCP tools**.

The agent has to diagnose the incident from observable evidence.

The deterministic environment makes those workflows reproducible enough to evaluate.

---

## Incident scenarios

Firebro includes five incident scenarios with different failure modes.

### 1. Checkout degradation

A bad checkout deployment causes latency and errors.

There are other unhealthy-looking services in the environment, so the newest or loudest signal is not automatically the correct answer.

A rollback is the effective remediation.

### 2. Platform-wide latency

Database connection-pool exhaustion causes latency across multiple services.

A recent payments deployment acts as a plausible distraction.

The correct response is to address the resource bottleneck rather than blindly rolling back the latest deployment.

### 3. Pricing errors

Checkout begins returning incorrect prices even though there was no relevant recent deployment.

The cause is a feature flag.

The appropriate remediation is to disable the flag.

### 4. Notification backlog

A notification service develops a memory problem and begins failing.

Restarting it may help temporarily without fixing the underlying problem.

This scenario tests whether the agent verifies recovery instead of immediately declaring the incident resolved.

### 5. Payment provider failure

The source of the incident is an external provider.

Making unnecessary internal changes can be worse than waiting or using an available fallback.

Sometimes the correct operational action is **not to change anything**.

---

## Why multiple scenarios matter

If every incident were solved by:

> find latest deployment → rollback

then the agent would not actually be doing incident response.

Firebro includes plausible distractions, partial remediations, ineffective actions, and cases where intervention is unnecessary.

The goal is to test whether the agent can correlate evidence and respond to what actually happened.

---

## Incident lifecycle

Incidents move through an explicit lifecycle:

```text
TRIGGERED
   ↓
OPEN
   ↓
INVESTIGATING
   ↓
DIAGNOSIS_FOUND
   ↓
REMEDIATION_PROPOSED
   ↓
WAITING_FOR_APPROVAL
   ↓
MITIGATING
   ↓
RECOVERING
   ↓
MONITORING
   ↓
RESOLVED
```

Recovery is not assumed just because a remediation tool returned successfully.

If an action has no effect or makes the incident worse, the workflow can move backward and investigation continues.

---

## WebMCP implementation

Firebro exposes a broad set of meaningful WebMCP capabilities instead of a collection of low-level UI click tools.

The tool surface covers investigation, incident management, remediation, approvals, and recovery.

Tool availability can change based on application context such as:

- the currently selected incident
- the incident lifecycle state
- the operator's role
- whether an approval is pending
- whether a remediation is currently valid

This keeps the tool surface closer to the actions that make sense in the current state instead of exposing every capability all the time.

Tool descriptions also include guidance about when a capability should and should not be used.

Read-heavy tools return shaped evidence rather than dumping large quantities of raw telemetry into the agent context.

For example, log and metric tools can return relevant windows, summaries, evidence references, and explicit empty results instead of thousands of unfiltered records.

---

## WebMCP tool groups

### Investigation

Examples include:

- `get_active_incidents`
- `get_incident`
- `get_service_health`
- `get_service_dependencies`
- `get_recent_deployments`
- `get_recent_changes`
- `query_logs`
- `search_traces`
- `compare_metrics`
- `inspect_alert`
- `get_runbook`
- `get_incident_timeline`

### Actions

Examples include:

- `create_incident`
- `assign_incident`
- `add_incident_note`
- `rollback_deployment`
- `restart_service`
- `scale_service`
- `disable_feature_flag`
- `resolve_incident`

### Approval workflow

Examples include:

- `get_pending_approvals`
- `request_approval`
- `record_approval`
- `record_rejection`

The goal is not to maximize the number of tools.

The goal is to expose the incident-response workflow at the right semantic level.

---

## Untrusted operational data

Logs, alerts, traces, and other observability data are treated as untrusted input.

A production log line should not become an instruction simply because an agent can read it.

Firebro separates operational evidence from instructions and keeps consequential actions behind the approval boundary.

One simulated scenario can include adversarial text inside telemetry specifically to test that boundary.

---

## Architecture

At a high level:

```text
Human operator
      │
      ▼
Firebro incident console
      │
      ├── WebMCP capability layer
      │         │
      │         ▼
      │   Agent investigation
      │
      ├── Approval workflow
      │
      ▼
Application API
      │
      ├── authorization
      ├── action validation
      └── approval validation
      │
      ▼
Deterministic incident simulator
      │
      ├── service state
      ├── deployments
      ├── metrics
      ├── logs
      ├── traces
      └── incident events
```

The simulated world is deterministic, while mutations and incident events are persisted so browser state, WebMCP tools, and the console stay synchronized.

---

## Built with

- WebMCP
- TypeScript
- React
- Vite
- Tailwind CSS
- Recharts
- react-window
- Vitest
- Netlify Functions
- Netlify Blobs

There is deliberately no long-lived server process, no SQLite, and no SSE. A Netlify Function is a fresh invocation every time, so state is event-sourced onto Netlify Blobs and the console polls adaptively instead of holding a stream open.

---

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - the workspace, the deterministic simulator, the event-sourced backend, and the 1.5K tool-response cap.
- [docs/WEBMCP.md](docs/WEBMCP.md) - the tool surface in detail: dynamic registration, the two declarative forms, and why `reason` is required on every read-only tool.
- [docs/SECURITY.md](docs/SECURITY.md) - the authorization model, why an agent cannot approve its own request, and what that does and does not rule out.
- [docs/SPEC-FEEDBACK.md](docs/SPEC-FEEDBACK.md) - six things building this taught us about WebMCP, including two that cost real debugging time.
- [evals/RESULTS.md](evals/RESULTS.md) - real agents investigating the live API, a tuned-vs-naive tool-description ablation, and what was not measured.

---

## Testing and evaluation

Firebro is designed to be tested as an agent-operated application, not only as a collection of individual functions.

Testing covers:

- deterministic simulation behavior
- WebMCP tool contracts
- incident state transitions
- remediation outcomes
- approval enforcement
- evidence correlation
- browser-level agent workflows
- UI behavior after tool calls

The goal is to verify more than whether a tool can be called successfully.

A good run should show that the agent:

1. gathers relevant evidence
2. avoids jumping to the first plausible explanation
3. proposes an appropriate remediation
4. respects the approval boundary
5. verifies recovery after the action

---

## Try it

**Live: https://firebro.netlify.app**

Open it in ChatGPT's in-app browser, or in Chrome. The origin is registered for the WebMCP origin
trial, so **Chrome 149-156 needs no flag** - the tools register on page load. On any other browser,
enable `chrome://flags/#enable-webmcp-testing`.

Start with the active checkout incident and ask:

> Investigate the active checkout incident. Find the most likely cause and show me the evidence before taking any remediation action.

Then ask:

> What would you do next?

The important part is not whether the agent immediately guesses the root cause.

Watch how it moves through the incident evidence, proposes an action, and reaches the approval boundary.

Approve the remediation from the Firebro console and continue monitoring the incident to verify recovery.

You can also try other incidents. They are intentionally designed so the same remediation strategy does not work every time.

---

## What Firebro is not

Firebro is a hackathon project running against deterministic simulated infrastructure.

It is not a replacement for Datadog, Grafana, PagerDuty, or an existing production incident-management stack.

The project is exploring a different question:

**What should an operational console look like when both humans and agents are first-class users of it?**

---

## License

MIT
