# Architecture

## Layout

A pnpm workspace, four packages, one deployed Netlify site:

```text
packages/shared    types + JSON Schemas shared by sim, api, and web
packages/sim       deterministic simulation engine — no server, no browser
apps/api           event-sourced backend — one Netlify Function, Blobs-backed
apps/web           React console + the WebMCP tool registrations
```

`node-linker: hoisted` in `pnpm-workspace.yaml` is load-bearing, not incidental — without it,
deployed functions fail at runtime with `Cannot find package` for the workspace packages. `apps/api`
imports `sim`/`shared` through relative-path shim files (`simEngine.ts`/`sharedTypes.ts`), never the
bare `@incident-commander/*` specifier, for the same reason.

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
directly, not just by construction.

Routing is one catch-all Netlify Function (`apps/api/src/functions/api.ts`) with its own tiny
path-pattern router dispatching into `routes/*.ts` — not one Netlify Function per endpoint. Each
route module is a thin translation from HTTP to the sim engine and the Blobs-backed event log.

**Authorization is layered and entirely server-side** (`authz/{roles,approvalToken,actionBinding}.ts`,
`audit/log.ts`) — see `docs/SECURITY.md` for the full model. WebMCP registration is never treated as
an authorization mechanism; it's the agent's *interface*, and every layer below it re-checks
independently of what the client claims it registered.

## `apps/web` — the console and the tool surface

`src/console/` is the React UI: `AppShell` (layout), `Surface` (the region/float/vitals primitives
every screen is built from), `Masthead`, `Nav`, `Topology` (hand-rolled SVG), `MetricsChart`
(Recharts + custom deploy-marker/onset overlays), `EvidenceTabs` (virtualized logs, trace
waterfalls, deployment/change tables), `Timeline`, `AgentLane` (the agent drawer and its collapsed
rail), `ApprovalCard`, `SupportingPages` (Services/Deployments/Alerts/Runbooks/Activity),
`DeclarativeForms` (the two `<form toolname>` tools). `useConsoleData` drives the adaptive polling
loop against `/api/state` — four tiers, 5s idle down to 400ms while a remediation is recovering.

`src/webmcp/` is the WebMCP layer: `tools/*.ts` (one file per tool group, each fetching the API and
reshaping the response — see `shape.ts`'s response-cap discipline, below), `registerTools.ts`
(dynamic registration — see `docs/WEBMCP.md`), `apiClient.ts`, `sessionId.ts`.

`src/console/toolActivity.tsx` is the seam between the two halves — a React context fed by
`registerTools.ts`'s instrumentation layer, so every tool call updates both the activity rail *and*
whichever console panel that tool's evidence belongs in (topology pulse, evidence-tab auto-switch,
metrics chart bolding, panel glow). This is the literal mechanism behind the shared-context claim in
`docs/WEBMCP.md` — not a rendering afterthought, the thing the reactivity contract in the plan
exists to specify.

### The 1.5K response cap

Every tool response is shaped (`apps/web/src/webmcp/shape.ts`) to fit under 1.5K characters —
capped log/trace samples, pattern-grouped summaries instead of raw dumps, explicit "N more omitted"
markers rather than silent truncation. Asserted against synthetic worst-case inputs (200 log
patterns, 20 traces × 10 spans, all 7 services × 13 metrics), not just today's actual scenario data,
so the cap holds structurally rather than by accident of how much data any one incident happens to
have.

## Deploy

Netlify, one site, both `apps/api` (Functions) and `apps/web` (static) built and deployed together
with the exact command documented in `phase-summary.md`'s "Deploying this project" section — the
flags are load-bearing; a plausible-looking variant deploys zero functions with no error, or
deploys them in a way that fails at runtime with a dependency-not-found error that only shows up
once a function actually executes.

## Testing

`packages/sim/test/` — 46 tests: determinism (including the prefix-stability property above),
evidence integrity (no leaked ground truth), the correlation contract (a cause must precede its
effect; the decoy in INC-4822 postdates its symptoms), remediation outcomes, and phase shapes.
`apps/web/test/` — 5 tests holding the 1.5K response cap above against synthetic worst-case inputs.
Both suites, plus `pnpm -r typecheck` and a live Lighthouse run against production, are what CI
runs on every push (`.github/workflows/ci.yml`).
`evals/` is a separate, larger-scale verification layer — real Claude subagents investigating the
live production API — described in `evals/RESULTS.md` and `docs/WEBMCP.md`.
