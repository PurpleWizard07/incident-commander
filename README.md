# Incident Commander

[![CI](https://github.com/PurpleWizard07/incident-commander/actions/workflows/ci.yml/badge.svg)](https://github.com/PurpleWizard07/incident-commander/actions/workflows/ci.yml)

**Live:** https://incident-commander-461.netlify.app

A production incident-response console where an AI agent investigates through structured WebMCP
tools while the human responder watches the same evidence in the same interface, and retains sole
authority to change production. Built for the WebMCP Challenge.

## Why this is a WebMCP project and not a chat wrapper over an MCP server

A server-side MCP over a Datadog- or PagerDuty-shaped tool set would produce a chat transcript
describing an incident — a reasonable thing to build, and not what makes this project specifically
a WebMCP one. **The agent operates the same console the human is watching.** All 12 investigation
tools have a specified visible effect in the UI — topology nodes pulse, the evidence panel
auto-switches tabs and scrolls to the matching log line, the metrics chart bolds the series and
marks the deploy that caused it, an overlay spotlights the runbook being read. The approval card the
agent's `request_approval` call produces sits beside the graph that justifies it, the topology node
that turned red, and the log line that proves it — in the same interface the responder is already
looking at, at the moment of the decision. That shared context is only possible because the tool
calls and the console rendering share an origin's DOM; a server MCP has no equivalent. Full argument
and implementation in [`docs/WEBMCP.md`](docs/WEBMCP.md).

**Human authority boundary:** WebMCP is the agent's interface, not the security boundary. Every one
of the four production-changing tools (`rollback_deployment`, `restart_service`, `scale_service`,
`disable_feature_flag`) requires an approval token that only a real, trusted click in the console
can mint — an agent that calls `request_approval` and then tries to approve its own request is
denied and the attempt is audited. Full model in [`docs/SECURITY.md`](docs/SECURITY.md).

## Try it

### ChatGPT in-app browser (primary judge surface)

Open the live URL above inside ChatGPT's in-app browser. Ask it to investigate the open incident —
it discovers and calls tools directly through `document.modelContext`.

### Chrome, with the WebMCP flag

Enable `chrome://flags/#enable-webmcp-testing`, open the live URL. Chrome ships no built-in chat
agent yet, so to execute a tool call manually (no LLM needed) use the [Model Context Tool
Inspector](https://github.com/beaufortfrancois/model-context-tool-inspector) extension's **Execute
Tool** action, or drive it from an actual agent (e.g. a Claude/GPT browser-automation session)
pointed at the tab.

An **origin trial token** is registered and shipped (`apps/web/index.html`), covering Chrome
149–156 — the trial runs through 2026-11-17. On a Chrome build inside that range, the token alone
is enough; the flag above is the fallback for anyone outside it.

### Scenarios and seeds

Five incidents, selectable via query parameters — `?scenario=<id>&seed=<n>` — or the scenario
picker in the header. Seed defaults to `42`; the simulation is fully deterministic per
`(scenario, seed)`.

| Scenario | Title | What a correct investigation finds |
|---|---|---|
| `INC-4821` | Checkout degradation | A bad deploy (`checkout-v3`) broke token validation; `payments`' errors are downstream fallout, not the cause |
| `INC-4822` | Platform-wide latency | A reconciliation job exhausted the database connection pool; a fresh `payments-v7` deploy is a decoy that postdates the symptoms |
| `INC-4823` | Checkout pricing errors | A feature-flag rollout, not a deploy, broke pricing — `get_recent_deployments` comes back empty on purpose |
| `INC-4824` | Notification backlog | A runtime memory leak (GC pressure, OOM restarts), independent of any deploy or config change |
| `INC-4825` | Payment provider failure | An external provider outage — the correct action is to route around it via a flag, or take no action at all; scaling/restarting our own service doesn't help |

`https://incident-commander-461.netlify.app/?scenario=INC-4821&seed=42` loads the hero incident
directly.

### Local development

```bash
pnpm install
netlify dev --filter @incident-commander/api -c "pnpm --filter web dev" --target-port 5173
```

(`netlify dev` needs Windows Developer Mode enabled if developing on Windows — a symlink-permission
issue, not a code issue; Linux, including the actual deployed runtime, doesn't hit this.)

## Tool surface

21 imperative tools registered via `document.modelContext.registerTool()`, plus 2 declarative
`<form toolname="…">` tools (`add_incident_note`, `create_incident`) — 23 distinct tools, all
audited against a real use. The registered surface changes with application state (role, incident
selection, incident state, approval presence) rather than being a static dump at page load. Full
breakdown in [`docs/WEBMCP.md`](docs/WEBMCP.md).

## Verification — artifacts a judge can check, not just claims

| | |
|---|---|
| **Lighthouse** | Agentic Browsing **4/4** checks passing; performance 0.99, accessibility 1.0, best-practices 1.0, SEO 1.0 (desktop preset, matching the judge environment; performance samples 0.98–0.99 run to run). Report: [`docs/lighthouse-report.report.html`](docs/lighthouse-report.report.html) · Screenshot: [`docs/lighthouse-scores.png`](docs/lighthouse-scores.png) |
| **Eval suite** | 30 hand-written cases across all 5 scenarios, **58/60 passed (96.7%)**, including a tuned-vs-naive tool-description ablation. Full results and methodology, including the one genuine miss (a self-found, root-caused eval-suite gap, not a description-quality issue): [`evals/RESULTS.md`](evals/RESULTS.md) |
| **CI** | Every push: typecheck across all 4 workspace packages, 46 simulation-engine tests (determinism, evidence integrity, correlation contract, remediation, phase shapes), and a live Lighthouse run against production. [`.github/workflows/ci.yml`](.github/workflows/ci.yml) |

**On the eval methodology:** the eval numbers above come from a self-built harness — real Claude
Sonnet 5 subagents calling tools against the live production API, with a mechanically-logged trace
independent of the agent's self-report — rather than Chrome's `webmcp-tools` CLI eval runner (whose
exact configuration wasn't fully specified against the actual repo at the time of writing). The
ChatGPT-in-app-browser and Chrome-native paths above are verified **manually and qualitatively**,
not quantitatively; conflating the two would overclaim, so they're reported separately.

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — monorepo layout, the deterministic simulation
  engine, the event-sourced backend, why Netlify Blobs and polling instead of SQLite/SSE.
- [`docs/WEBMCP.md`](docs/WEBMCP.md) — the tool surface, declarative forms, dynamic registration,
  the shared-context argument in full.
- [`docs/SECURITY.md`](docs/SECURITY.md) — the authorization layers, the self-approval denial, the
  prompt-injection mitigations (including a seeded, inert injection attempt left in on purpose).
- [`docs/SPEC-FEEDBACK.md`](docs/SPEC-FEEDBACK.md) — four real edges hit while building against
  `document.modelContext`: progress reporting, output schemas, elicitation, multi-tool skills.
- [`evals/RESULTS.md`](evals/RESULTS.md) — the eval suite and ablation, in full.

## What we will not claim

- This is a simulation. No real infrastructure, credentials, or production system is reachable
  through it.
- The authorization model here is what a real production deployment would need to build, not a
  claim that agent authorization is a solved problem.
- The Lighthouse fraction measures agentic readiness, not product quality.
- Eval pass rates are model- and prompt-dependent. Ours are reported against one pinned model
  (Claude Sonnet 5), named as such — see [`evals/RESULTS.md`](evals/RESULTS.md) for exactly what
  was and wasn't measured quantitatively.

## License

MIT — see [LICENSE](LICENSE).
