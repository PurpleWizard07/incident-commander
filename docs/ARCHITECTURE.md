# Architecture

## Layout

A pnpm workspace, four packages, one deployed Netlify site
([firebro.netlify.app](https://firebro.netlify.app)):

```text
packages/shared    TypeScript types + the WebMCP DOM declarations, shared by sim, api, and web
packages/sim       deterministic simulation engine — no server, no browser
apps/api           event-sourced backend — one Netlify Function, Blobs-backed
apps/web           React console + the WebMCP tool registrations
```

`node-linker: hoisted` in `pnpm-workspace.yaml` is load-bearing, not incidental — without it,
deployed functions fail at runtime with `Cannot find package` for the workspace packages. `apps/api`
imports `sim`/`shared` through relative-path shim files (`simEngine.ts`/`sharedTypes.ts`), never the
bare `@incident-commander/*` specifier, for the same reason. (The package scope is still
`@incident-commander/*`; only the deployed site and the product were renamed to Firebro.)

`packages/shared` holds domain types (`ServiceId`, `ServiceHealth`, `Role`, the event and audit
shapes) and `webmcp-dom.d.ts`, which is what makes `document.modelContext`, `toolname`/
`tooldescription` attributes and `SubmitEvent.agentInvoked` type-check at all. There is no shared
JSON Schema module: each tool's `inputSchema` is declared inline in its own module under
`apps/web/src/webmcp/tools/`, and the matching server-side re-validation is hand-written per route —
see [`SECURITY.md`](SECURITY.md) for why that duplication is deliberate and what it costs.

## `packages/sim` — the world is deterministic and has no opinion about HTTP

A seeded PRNG (`prng.ts`) and virtual clock (`clock.ts`) drive every generator —
`generators/{metrics,logs,traces,deployments}.ts`. Five scenarios (`scenarios/hero-checkout.ts` for
INC-4821, then `inc-4822-*.ts` … `inc-4825-*.ts`) are pure data: a starting state, a set of
`groundTruth` correlations, and a remediation table. `world.ts` materializes a `(scenario, seed,
nowMinute)` triple into the actual metric points, log lines, traces, deployments, changes, and
alerts an incident-response console would show.

**One independently-seeded `Rng` per generation concern**, keyed by a stable id — never one shared
stream threaded across metric series, log templates, and trace shapes sequentially. This was a real
bug, not a hypothetical: sharing one `Rng` meant a metric series consumed a `nowMinute`-dependent
number of draws before the next series' generator ran, so a *past* data point's value silently
depended on how far into the future the world was ever asked to generate — breaking the "same input
→ same output, and a past point never changes" contract the whole system depends on. Fixed by giving
every series/template/shape its own stream; covered by `packages/sim/test/determinism.test.ts`'s
prefix-stability assertion.

No generated record — no metric point, log line, span, deployment, or change — ever contains a
`groundTruth` field or an embedded `scenarioId`. `World.scenarioId` itself is legitimate
engine-internal bookkeeping (a materialized world has to know which scenario it is), but it and
`groundTruth` never make it into anything `apps/api` turns into an HTTP response. That boundary is
enforced by convention and tested by `evidence-integrity.test.ts`, not by a type system that could
catch a violation automatically — worth knowing if you extend a scenario.

## `apps/api` — event-sourced, one Netlify Function

**Why not SQLite, Fastify, or SSE:** all three assume a long-lived process. A Netlify Function is a
fresh invocation every time; nothing here relies on in-memory state surviving between calls, and
killing/restarting a function loses nothing because state lives in Netlify Blobs, not memory. Live
updates are **adaptive polling** (`GET /api/state?since=<seq>` as a cheap heartbeat, heavier
endpoints refetched only when something actually changed) rather than SSE, which doesn't survive a
serverless function's lifecycle cleanly.

State is **event-sourced**: one Blobs key per session, strong-consistency reads, optimistic `seq`
writes. The event log is the source of truth; every read derives the current world by replaying it
over the deterministic sim engine. Two concurrent sessions never see each other's state — verified
directly, not just by construction. A session is identified by the `X-Session-Id` request header
(defaulting to `anonymous` for `curl` convenience); there is no login, and that is a deliberate
limit of the simulation rather than an oversight — see [`SECURITY.md`](SECURITY.md)'s closing
section.

Routing is one catch-all Netlify Function (`apps/api/src/functions/api.ts`) with its own tiny
path-pattern router dispatching into `routes/*.ts` — not one Netlify Function per endpoint. Each
route module is a thin translation from HTTP to the sim engine and the Blobs-backed event log.

Some endpoints are deliberately **console-only** — reachable over HTTP, but never registered as a
WebMCP tool, so nothing in the agent's surface leads to them: `GET /api/approvals/:id/nonce` (the
approval token, and the whole reason the agent cannot self-approve), `GET /api/audit`, `GET
/api/metrics/series` (the metrics chart's full point data, where `compare_metrics` only ever returns
a stripped-down summary), and `POST /api/sim/*` (scenario/seed control).

**Authorization is layered and entirely server-side** (`authz/{roles,approvalToken,actionBinding}.ts`,
`audit/log.ts`) — see [`SECURITY.md`](SECURITY.md) for the full model. WebMCP registration is never
treated as an authorization mechanism; it's the agent's *interface*, and every layer below it
re-checks independently of what the client claims it registered.

## `apps/web` — the console and the tool surface

`src/console/` is the React UI: `AppShell` (layout and the registration generations), `Surface` (the
region/float/vitals primitives every screen is built from), `Masthead`, `Nav`, `IncidentWorkspace`
(the incident screen that composes the rest), `Topology` (hand-rolled SVG), `MetricsChart` (Recharts
+ custom deploy-marker/onset overlays), `EvidenceTabs` (virtualized logs, trace waterfalls,
deployment/change tables), `EvidenceSpotlight` and `evidenceJump` (the overlay and scroll-to-row
plumbing a tool call triggers), `Timeline`, `AgentLane` (the agent drawer, its collapsed rail, and
`AgentInvitation` — the one card that tells a newcomer with an agent attached how to start),
`ApprovalCard`, `SupportingPages` (Services/Deployments/Alerts/Runbooks/Activity, behind the six-item
`Nav`), `DeclarativeForms` (the two `<form toolname>` tools), and `confidence.ts` (the evidence-cited
confidence readout). `useConsoleData` drives the adaptive polling loop against `/api/state` — four
tiers: 5s idle, 2s with an incident open, 750ms during tool activity, 400ms while a remediation is
recovering.

`src/webmcp/` is the WebMCP layer: `tools/*.ts` (one file per tool group, each fetching the API and
reshaping the response — see `shape.ts`'s response-cap discipline, below), `registerTools.ts`
(dynamic registration — see [`WEBMCP.md`](WEBMCP.md)), `apiClient.ts`, `sessionId.ts`.

`src/console/toolActivity.tsx` is the seam between the two halves — a React context fed by
`registerTools.ts`'s instrumentation layer, so every tool call updates both the activity rail *and*
whichever console panel that tool's evidence belongs in (topology pulse, evidence-tab auto-switch,
metrics chart bolding, panel glow). This is the literal mechanism behind the shared-context claim in
[`WEBMCP.md`](WEBMCP.md) — not a rendering afterthought, the thing the reactivity contract in the
plan exists to specify.

### The 1.5K response cap

Every tool response is shaped (`apps/web/src/webmcp/shape.ts`) to fit under 1.5K characters —
capped log/trace samples, pattern-grouped summaries instead of raw dumps, explicit "N more omitted"
markers rather than silent truncation. Asserted against synthetic worst-case inputs (200 log
patterns, 20 traces × 10 spans, all 7 services × 13 metrics), not just today's actual scenario data,
so the cap holds structurally rather than by accident of how much data any one incident happens to
have. `shape.ts` also owns the untrusted-content sanitizer and envelope described in
[`SECURITY.md`](SECURITY.md).

### Layout

The console is designed desktop-first, but ChatGPT's in-app browser is a stated P0 surface, so there
is a real responsive path rather than a hope: `max-md:` overrides only, leaving every desktop class
untouched. The session bar wraps instead of overflowing, vitals become a 2×2 grid with
position-computed hairlines, the two analysis rows stack, evidence tables scroll horizontally inside
their own container, and the masthead title and its metadata row wrap. Measured at 390/820/1440 with
`scrollWidth === clientWidth` and no page errors, with and without an agent interface — the page
body never scrolls sideways at any of them.

## Deploy

Netlify, one site, both `apps/api` (Functions) and `apps/web` (static) built and deployed together
with the exact command documented in `phase-summary.md`'s "Deploying this project" section — the
flags are load-bearing; a plausible-looking variant deploys zero functions with no error, or
deploys them in a way that fails at runtime with a dependency-not-found error that only shows up
once a function actually executes.

`apps/web/index.html` carries the WebMCP origin trial token for `https://firebro.netlify.app`, which
is what makes the tool surface appear flag-free on Chrome 149–156. It is a **first-party** token and
must stay one; the comment above it in that file explains what happens if it isn't, and covers only
that exact host, so deploy-preview URLs still need the flag.

## Testing

`packages/sim/test/` — **46 tests** across six files: determinism (including the prefix-stability
property above), evidence integrity (no leaked ground truth), the correlation contract (a cause must
precede its effect; the decoy in INC-4822 postdates its symptoms), remediation outcomes, scenarios
2–5, and phase shapes.
`apps/web/test/shape-budget.test.ts` — **5 tests** holding the 1.5K response cap above against
synthetic worst-case inputs.

Both suites, plus `pnpm -r typecheck` and a live Lighthouse run against production, are what CI runs
on every push (`.github/workflows/ci.yml`). The Lighthouse job is a gate, not a report: it fails the
build if `agentic-browsing` or `accessibility` is anything but a perfect 1. The committed
`lighthouse-report.report.{json,html}` in this folder is that job's own artifact from CI run
`33751024191` (commit `b6decc2`, 2026-09-03) — performance, accessibility, best-practices, SEO and
agentic-browsing all **1.0**, with `webmcp-registered-tools`, `webmcp-schema-validity`,
`agent-accessibility-tree` and `llms-txt` each passing. `lighthouse-scores.png` is the score strip
from that report and `lighthouse-final-screenshot.png` is the console itself on production.

Only the two gated categories are guaranteed. **Performance floats between 0.98 and 1.0 across
runs** — it is a live network measurement of a real deployment, so it moves with the runner, and a
local run on a home connection scores lower still. The committed report is one honest run, not a
best-of; treat the two gates as the standing claim and performance as consistently very good.

`evals/` is a separate, larger-scale verification layer — real Claude subagents investigating the
live production API — described in [`evals/RESULTS.md`](../evals/RESULTS.md) and
[`WEBMCP.md`](WEBMCP.md).
