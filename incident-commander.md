# Incident Commander

## 1. Executive summary

### Working title

**Incident Commander**

A WebMCP-native production incident response control plane where an agent investigates incidents, correlates operational evidence, proposes remediation, requests human authorization for consequential actions, executes approved changes, and verifies recovery.

The project is a **deterministic production simulation**, not a connection to a real production environment.

### Core thesis

The product should answer:

> **What happens when a web application is designed so an AI agent can actually operate an operational control plane?**

The human defines the objective and retains authority.

The agent performs investigation, correlation, repetitive operations, and verification.

The core loop is:

**observe → investigate → reason → propose → obtain authority → act → verify.**

---

## 2. Why this fits WebMCP

The challenge evaluates:

1. WebMCP Leverage
2. Execution
3. Potential Impact
4. Creativity & Ambition

all equally.

Incident response naturally maps to all four.

### WebMCP Leverage

We can expose domain-specific tools rather than generic UI automation:

- service health
- deployment history
- logs
- metrics
- traces
- alerts
- runbooks
- incident timeline
- rollback
- feature flag changes
- service restart
- scaling
- incident notes
- incident resolution

### Execution

The product can be a complete operational console:

- service topology
- incident list
- metrics
- logs
- traces
- deployment history
- agent activity
- recommendation cards
- approval controls
- audit history
- dynamic simulated recovery

### Potential impact

The audience is concrete:

- SREs
- DevOps teams
- platform engineers
- software engineers
- on-call responders
- incident commanders

The problem is concrete:

During production incidents, responders need to gather evidence from several operational surfaces, understand the likely cause, choose a mitigation, and verify the result under time pressure.

The project demonstrates a way for an agent to perform much of that workflow through explicit application capabilities.

### Creativity

Instead of “AI monitors an app,” the concept is:

> **The operational web application itself becomes an agent-operable environment with explicit investigation and remediation capabilities and an intentional human authorization boundary.**

---

## 3. Why use a simulation

Do not connect the hackathon project to real infrastructure.

A deterministic synthetic environment is better for the competition:

- repeatable
- fast
- safe
- judgeable
- no credentials
- no third-party outages
- no destructive production actions
- easy to reproduce locally
- easy to make visually convincing

The simulation should behave like a small real production platform.

---

## 4. Hero incident

Use one excellent incident rather than many mediocre incidents.

### Scenario

```text
10:41 — checkout-v3 deployed
10:44 — checkout error rate begins rising
10:47 — payment failures spike
10:48 — alert triggered
10:49 — incident opened
```

### Current state

```text
Checkout       DEGRADED   64% errors
Payments       DEGRADED   83% errors
Database       HEALTHY
Auth           HEALTHY
Queue          HEALTHY
```

The seeded data should make the correct diagnosis discoverable through evidence.

---

## 5. Hero workflow

### Human request

> “Investigate the checkout incident. Find the likely cause and tell me what you recommend.”

### Agent investigation

```text
get_active_incidents()
get_incident()
get_service_health("checkout")
get_service_health("payments")
get_service_health("database")
get_recent_deployments("checkout")
get_recent_changes()
query_logs()
compare_metrics()
search_traces()
```

### Diagnosis

The agent concludes:

- checkout errors increased shortly after the deployment
- database remains healthy
- authentication remains healthy
- failing traces correlate with checkout-v3
- error logs show a newly introduced failure pattern

Agent:

> “The strongest evidence points to checkout-v3. I recommend rolling it back.”

### Human authority

The system shows:

```text
PROPOSED ACTION

Rollback checkout-v3 → checkout-v2

Reason
Error rate increased after deployment and failing
traces correlate with checkout-v3.

Risk: Medium

[Reject]     [Approve]
```

Human approves.

### Agent action

```text
rollback_deployment(
  service="checkout",
  deploymentId="checkout-v3"
)
```

### Simulated outcome

```text
64%
 ↓
31%
 ↓
7%
 ↓
0.8%
```

Dashboard updates.

The deployment state changes.

Timeline updates.

### Verification

Agent:

> “Rollback completed. Checkout error rate is now 0.8%. I recommend monitoring before resolving the incident.”

---

## 6. WebMCP tool surface

### Investigation tools

```text
get_active_incidents
get_incident
get_service_health
get_service_dependencies
get_recent_deployments
query_logs
search_traces
compare_metrics
inspect_alert
get_runbook
get_recent_changes
get_incident_timeline
```

### Action tools

```text
create_incident
assign_incident
rollback_deployment
restart_service
disable_feature_flag
scale_service
add_incident_note
resolve_incident
```

### Human-control tools

```text
get_pending_approvals
request_approval
record_approval
record_rejection
```

The tool surface should demonstrate both depth and deliberate trust boundaries.

---

## 7. Read vs. mutating tools

### Read-only

The agent can generally inspect:

- service health
- logs
- metrics
- traces
- deployments
- runbooks
- alerts

### Mutating

The agent may propose or perform:

- rollback
- restart
- scaling
- feature flag change
- incident closure

### Human control

Actions with production consequences cross an approval boundary.

This creates a clear model:

```text
READ
  ↓
INVESTIGATE
  ↓
PROPOSE
  ↓
HUMAN APPROVAL
  ↓
WRITE
  ↓
VERIFY
```

---

## 8. Example WebMCP registration

```javascript
document.modelContext.registerTool({
  name: "get_service_health",
  title: "Get service health",
  description: "Inspect the current health of a production service.",
  inputSchema: {
    type: "object",
    properties: {
      service: {
        type: "string",
        enum: [
          "frontend",
          "checkout",
          "payments",
          "auth",
          "database",
          "queue"
        ]
      }
    },
    required: ["service"]
  },
  execute: async ({ service }) => {
    return getServiceHealth(service);
  }
});
```

A write tool should have explicit semantics, scoped permissions, and server-side authorization.

WebMCP is the agent interface, not the security boundary.

---

## 9. State machine

The incident should have real application state.

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

This enables meaningful tool chaining and continuation.

The agent behaves differently depending on state.

For example:

- `INVESTIGATING` → inspect evidence
- `WAITING_FOR_APPROVAL` → wait
- `RECOVERING` → monitor metrics
- `RESOLVED` → summarize and close

---

## 10. UI

### Navigation

```text
Incidents
Services
Deployments
Alerts
Runbooks
Activity
```

### Incident header

```text
INC-4821
Checkout degradation

SEV-1
64% error rate
```

### Service topology

```text
Frontend
   ↓
Checkout 🔴
   ↓
Payments 🔴
   ↓
Database 🟢
```

### Agent activity panel

```text
AGENT

✓ Incident identified
✓ Checkout health inspected
✓ Deployment history inspected
✓ Metrics correlated
✓ Logs searched
✓ Trace sample analyzed

Recommendation:
Rollback checkout-v3
```

### Approval card

Show:

- action
- evidence
- expected effect
- risk
- approval controls

### Timeline

```text
10:41 deployment checkout-v3
10:44 errors begin
10:48 alert
10:49 investigation
10:50 rollback approved
10:50 rollback complete
10:51 recovery
```

---

## 11. Synthetic operational data

Create believable but fictional data.

### Services

- frontend
- checkout
- payments
- auth
- database
- queue
- notifications

### Deployments

```text
checkout-v1
checkout-v2
checkout-v3
```

### Metrics

- request rate
- error rate
- latency
- CPU
- memory
- queue depth

### Logs

Example:

```json
{
  "timestamp": "2026-08-30T10:47:23Z",
  "service": "checkout",
  "level": "ERROR",
  "deployment": "checkout-v3",
  "message": "Payment token validation failed"
}
```

### Traces

Include:

- trace ID
- services visited
- failing span
- duration
- deployment version

All data should tell a consistent story so the agent's diagnosis is evidence-backed.

---

## 12. Investigation reasoning

Avoid an unexplained jump to the answer.

A strong investigation is:

```text
1. Checkout error rate increased at 10:44.
2. checkout-v3 was deployed at 10:41.
3. Database remained healthy.
4. Auth remained healthy.
5. Failing traces concentrate on checkout-v3.
6. Logs show a new validation error.
```

Then:

> “The deployment is the strongest causal signal available in the simulated evidence.”

This makes the demo feel like an actual investigation.

---

## 13. Human-agent boundary

### Agent

- observe
- correlate
- summarize
- propose
- prepare
- execute approved actions
- monitor

### Human

- define goals
- judge business risk
- approve high-impact changes
- override recommendations
- decide when to close or escalate

The philosophy is:

> **Agent capability, human authority.**

That is a core product feature.

---

## 14. Security story

The project should explicitly state:

1. WebMCP tools are not themselves the authorization boundary.
2. Server-side checks enforce permissions.
3. Mutating tools verify approval before acting.
4. Approvals should be action-specific.
5. Audit logs record the mutation and authorization.
6. Tool inputs and untrusted incident content should not be treated as instructions without validation.
7. The UI makes the consequences of an action visible before approval.

This gives us a meaningful trust/safety story rather than an autonomous-agent gimmick.

---

## 15. Edge cases

### Recovery before approval

> “The service recovered. Rollback is no longer recommended.”

### Failed rollback

> “Rollback failed because the target version is unavailable. Suggested alternative: disable feature flag.”

### Conflicting evidence

> “Evidence is inconclusive. I need human judgment before taking action.”

### Service unavailable

> “Trace data is unavailable. I do not have sufficient evidence for a high-confidence diagnosis.”

### Already rolled back

> “checkout-v3 is already rolled back. I will verify recovery instead.”

These create realism and safe behavior.

---

## 16. Demo plan

Target: around 2 minutes 20 seconds.

### 0:00–0:15 — Hook

Start on the live incident.

```text
Checkout 64% errors
Payments 83% errors
Database healthy
```

Human:

> “Investigate the checkout incident.”

### 0:15–0:50 — Investigation

Show tool activity.

```text
✓ active incident
✓ service health
✓ deployment history
✓ metrics
✓ logs
✓ traces
```

### 0:50–1:15 — Diagnosis

Agent:

> “The strongest correlation is checkout-v3, deployed four minutes before the error increase. I recommend rolling it back.”

### 1:15–1:30 — Authorization

Approval card.

Human clicks:

**Approve**

### 1:30–1:50 — Execution

Show simulated recovery:

```text
64% → 31% → 7% → 0.8%
```

### 1:50–2:10 — Verification

Agent:

> “Rollback completed. Error rate is 0.8%. I recommend monitoring before resolution.”

### 2:10–2:25 — WebMCP

Briefly show the registered tool interface.

Narration:

> “Instead of asking an agent to guess how to operate a dashboard, Incident Commander exposes structured investigation and remediation capabilities through WebMCP. The agent can investigate and prepare actions while production-changing operations remain behind human approval.”

End.

---

## 17. Architecture

```text
                  Human Operator
                        |
                        v
                Incident Console
                        |
                        v
              document.modelContext
                        |
       +----------------+----------------+
       |                |                |
       v                v                v
 Investigation       Reasoning         Actions
    Tools              Tools            Tools
       \                |                /
        \               |               /
         +--------------+--------------+
                        |
                        v
                Simulated Ops Engine
                        |
             +----------+----------+
             |                     |
             v                     v
        Incident State        Event Stream
```

Suggested stack:

- React + TypeScript
- Tailwind
- lightweight charting
- Node/TypeScript backend
- in-memory or SQLite state
- Netlify, Vercel, Cloudflare, or similar

Keep the simulation deterministic.

---

## 18. Must-have MVP

- polished incident console
- one excellent seeded incident
- service topology
- deployment history
- logs
- metrics
- traces
- runbook
- meaningful WebMCP tools
- agent investigation
- diagnosis/recommendation
- approval UI
- simulated remediation
- changing metrics
- audit timeline
- public deployment
- public repository
- open-source license
- testing instructions

### Avoid

- real production credentials
- real Kubernetes
- real cloud mutations
- a complicated observability integration
- many half-built incidents
- generic chatbot UI
- pretending the simulation is live infrastructure

---

## 19. Differentiation from generic “AI DevOps”

A weak version:

> “Ask AI why your server is down.”

A stronger version:

> “The agent can inspect the application's structured operational environment, form a diagnosis from multiple tools, propose an actual remediation, obtain human authorization, execute it, and verify the new system state.”

The second is an agent-native application.

---

## 20. Success test

Ask:

> “Could we remove WebMCP and leave almost the same product?”

The intended answer is no.

Without the WebMCP capability layer, the agent loses the structured interface to:

- inspect
- correlate
- propose
- act
- verify

The project is built around that interface.

---

## 21. Winning positioning

### Product

**An incident responder that can actually operate the incident control plane.**

### WebMCP

**Turn operational web capabilities into explicit tools an agent can safely reason over and invoke.**

### Human + agent

**Agents investigate and execute. Humans authorize consequential production changes.**

### Impact

**Reduce the time engineers spend collecting and correlating evidence during incidents while keeping production authority with humans.**

---

## 22. Strategic assessment

Incident Commander is our second major submission candidate.

Its biggest strength is its technical story:

- many meaningful tools
- chained investigation
- clear read/write distinction
- explicit approval boundary
- dynamic state transitions
- measurable recovery
- extremely visual demo

Its biggest weakness is domain credibility relative to the Service Desk concept.

Therefore the right strategy is not to overbuild it.

Build **one exceptionally believable incident** and make every tool, screen, and state transition support that story.

The target judge reaction is:

> “The agent didn't just explain an incident. It operated the application's investigation and remediation capabilities, while the human remained in control.”
