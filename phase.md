# Build phases

Thirteen phases. Each names the plan sections to read, what to build, a testable exit condition, and
what *not* to do in it.

**Rules that apply to every phase:**

- Read only the plan sections the phase names. The plan is 2,200 lines; reading it whole wastes the
  context this file exists to protect.
- A phase is done when its exit criteria are demonstrably true, not when the code looks finished.
- Commit at the end of every phase. Append to `phase-summary.md` before moving on.
- Record any decision the plan does not cover in `phase-summary.md` **as you make it**.

Phases 0–11 are the submission. Phase 12 is Tier 3 and is built only if everything before it is
complete and polished (plan §23).

---

## Phase 0 — Proof (go / no-go)

**Goal:** prove WebMCP works on a deployed URL in the browser a judge will actually use, before
building anything that assumes it does.

**Read:** plan §2 (all), §14.5, §16, §17, §21.1.

**Build:**
- `git init`, pnpm workspace, the directory skeleton from plan §16.
- `packages/shared` — types and JSON Schemas from plan §3.
- Minimal React console shell (no real UI yet) and one Netlify Function.
- **One tool**: `get_service_health`, returning hardcoded JSON.
- Register the console origin for the WebMCP origin trial; ship the token.
- Deploy to Netlify.

**Done when:**
- [ ] Live URL loads over HTTPS.
- [ ] **ChatGPT in-app browser** discovers the tool and executes it end to end. *(P0 — blocking)*
- [ ] Chrome 156 discovers and executes it **without the flag**, via the origin trial token.
- [ ] Chrome 156 with `chrome://flags/#enable-webmcp-testing` also works.
- [ ] Result of the tool call is visible in the page.
- [ ] `git log` shows an initial commit.

**Do not:** build UI, build the simulator, or add a second tool. This phase exists to fail fast.

> **If the ChatGPT in-app browser cannot discover the tool, stop and report before continuing.**
> Everything downstream assumes this works.

---

## Phase 1 — Simulation core

**Goal:** a deterministic operational world, verifiable with no browser and no UI.

**Read:** plan §3 (all), §4 (all), §5.0 and §5.1, §14.1, §14.3.

**Build:**
- `packages/sim`: seeded PRNG, virtual clock, phase shapes, generators for metrics / logs / traces /
  deployments / changes / alerts.
- Scenario definition format (plan §4.3) and the **hero scenario INC-4821 only**.
- Remediation model (plan §4.6) including `no_effect` as the default.
- Unit tests: determinism, evidence integrity, the correlation contract.

**Done when:**
- [ ] Same `(scenario, seed)` produces byte-identical output across 100 runs.
- [ ] INC-4821's evidence satisfies its `groundTruth` — failing spans, log patterns, onset ordering.
- [ ] `compare_metrics`-style onset calculation puts error onset *after* the deploy.
- [ ] `rollback_deployment(checkout, checkout-v3)` produces full recovery; every other action
      produces `no_effect`.
- [ ] No output anywhere contains `scenarioId` or `groundTruth`.

**Do not:** write scenarios 2–5 yet. Do not touch React.

---

## Phase 2 — Backend and store

**Goal:** the event-sourced API, verifiable with curl.

**Read:** plan §2.1, §2.2, §3.10, §3.11, §11, §12 (all).

**Build:**
- Netlify Functions for the endpoints in plan §11.
- Netlify Blobs store: one key per session, strong-consistency reads, optimistic `seq` writes.
- Event log as the source of truth; world derived over it (plan §2.1).
- `GET /api/state?since=<seq>`.
- AuthZ layer: roles, approval tokens, action binding, state gates, audit writer.

**Done when:**
- [ ] Every plan §11 endpoint responds correctly to curl.
- [ ] Two concurrent sessions do not see each other's state.
- [ ] A gated action without a valid approval is refused, and the refusal is in the audit log.
- [ ] Killing and restarting the function loses nothing — state is in Blobs, not memory.
- [ ] `since=<seq>` returns only newer events.

**Do not:** build UI. Do not register tools yet.

---

## Phase 3 — Investigation tool surface

**Goal:** all 12 read-only tools, registered and shaped.

**Read:** plan §6.1, §6.2, §6.3, §6.6, §6.7, §14.2.

**Build:**
- All 12 investigation tools from plan §6.3, with descriptions written to the §6.1 rules —
  including the negative clause and the explicit empty-result message.
- `readOnlyHint` on all; `untrustedContentHint` on `query_logs`, `search_traces`, `get_incident`.
- The response shaper (plan §6.6), all five rules.
- The `reason` parameter (plan §9.1) on every investigation tool.

**Done when:**
- [ ] Every tool response is under 1.5K characters, asserted in tests, at every incident minute.
- [ ] `get_recent_deployments` on an empty window returns the pointer to `get_recent_changes`.
- [ ] Every `inputSchema` matches its server-side schema — one source of truth.
- [ ] An agent in the ChatGPT in-app browser can investigate INC-4821 and reach the right diagnosis
      using only these tools.

**Do not:** add action tools. Do not build the console UI beyond what Phase 0 left.

---

## Phase 4 — Console shell

**Goal:** the operational console, static but complete and layout-stable.

**Read:** plan §1, §13 (all), §21.2 (the CLS decision specifically), §2.2.

**Build:**
- Layout from plan §13.1: nav, incident workspace, permanent right rail.
- Topology SVG, metrics chart (Recharts + custom overlays), evidence tabs, timeline.
- Adaptive state polling from plan §2.2.
- **CLS discipline from the first commit** — fixed-height containers, skeletons at final dimensions,
  fixed-row virtualized logs, reserved rail height, overlay toasts.

**Done when:**
- [ ] INC-4821 renders fully: topology, metrics with deploy marker, logs, traces, timeline.
- [ ] Polling updates the view without a full re-render.
- [ ] Lighthouse CLS is green on the incident screen.
- [ ] Nothing shifts when async content arrives.

**Do not:** wire tool calls to the UI yet — that is Phase 5.

---

## Phase 5 — Shared context (the thesis)

**Goal:** the agent's work becomes visible in the human's console. This is the phase the whole
submission rests on.

**Read:** plan §9 (all, including §9.1), §0 (the shared-context argument).

**Build:**
- The reactivity contract table in plan §9 — every investigation tool's required visible effect.
- UI event bus fed by the tool dispatch layer.
- Agent activity rail with per-call `reason` display (plan §9.1).

**Done when:**
- [ ] Every one of the 12 investigation tools produces its specified visible effect.
- [ ] Feedback begins when the call starts and settles when it returns — nothing appears finished
      early.
- [ ] Watching the rail, a human can follow *why* the agent is doing what it is doing.
- [ ] Recorded once end to end: it looks like the video described in plan §19.

**Do not:** let the agent drive the UI directly. The UI observes the agent; the human's view stays
authoritative.

---

## Phase 6 — Authority

**Goal:** approvals, actions, and honest remediation.

**Read:** plan §6.4, §6.5, §7 (all), §10 (all), §12.3.

**Build:**
- `request_approval` with required `evidenceRefs` and `notCovered`.
- Approval card (plan §10.2) with live evidence links.
- Approval token minting on trusted click; single-use, bound to a canonical `{tool, args}` hash.
- All 8 action tools; the 4 gated ones refuse without a consumed approval.
- Incident state machine (plan §7), including both reverse transitions.
- Recovery animation driven client-side from the returned curve.

**Done when:**
- [ ] The full hero loop runs: investigate → propose → approve → execute → 64%→0.8% → verify.
- [ ] The agent calling `record_approval` is **denied** and the attempt is in the audit log.
- [ ] An approval authorizes exactly one action with one argument set, once.
- [ ] `resolve_incident` outside `MONITORING` is refused with an actionable reason.
- [ ] Clicking an evidence link on the approval card scrolls to that evidence.

**Do not:** make any action succeed that plan §5.1 says should not.

---

## Phase 7 — Dynamic surface

**Goal:** the tool surface changes with application state.

**Read:** plan §8 (all), §21.3.

**Build:**
- One `AbortController` per registration generation; teardown and rebuild on state change.
- The variation table in plan §8.1 — incident selection, role, incident state, approval presence.
- Role switcher: responder / approver / observer.
- Declarative forms for `add_incident_note` and `create_incident` (plan §21.3), `toolautosubmit`
  deliberately omitted.
- `AbortSignal` cancellation with a visible Cancel control.

**Done when:**
- [ ] `toolchange` fires on incident selection and role switch.
- [ ] `observer` role sees no action tools registered at all.
- [ ] A declarative form visibly fills, styles via `:tool-form-active`, and returns through
      `respondWith()` on human submit.
- [ ] Unregister-for-authority vs. fail-loudly-for-feasibility behaves as plan §8.1 describes.

**Do not:** add `assign_incident` as a declarative form. It was cut deliberately.

---

## Phase 8 — Scenarios 2–5 and confidence

**Goal:** prove the investigation generalizes.

**Read:** plan §5.2–§5.5, §9.2, §15.

**Build:**
- INC-4822, INC-4823, INC-4824, INC-4825 as scenario data — no new engine code should be needed.
- Diagnosis confidence (plan §9.2), counted from attached evidence.
- Scenario picker in the header; `?scenario=` and `?seed=` parameters.
- The §15 edge cases, each falling out of the model rather than special-cased.

**Done when:**
- [ ] An agent correctly diagnoses all five without scenario-specific hinting.
- [ ] On INC-4822 it **declines** the decoy `payments-v7` rollback — or takes it, observes
      `no_effect`, and revises. Either is a pass; the second is better footage.
- [ ] On INC-4825 it declines to remediate and escalates instead.
- [ ] On INC-4824 confidence reads *Moderate* with an unexplained observation.
- [ ] The seeded prompt-injection line in INC-4822 changes nothing.

**Do not:** add engine features for these. If a scenario needs new engine code, the scenario format
in plan §4.3 is wrong — fix the format, not the scenario.

---

## Phase 9 — Supporting sections

**Goal:** the remaining console, so it reads as a product rather than a demo screen.

**Read:** plan §1, §13.2, §21.7.

**Build:** Services, Deployments, Alerts, Runbooks, Activity/Audit sections. Compact agent telemetry
readout in the rail header — one line only; detail lives on the audit page.

**Done when:**
- [ ] All six nav sections work and are reachable.
- [ ] The audit page shows denials distinctly.
- [ ] Runbook `toolHint` links resolve to real tools.

**Do not:** build an agent-observability product. One line in the rail. Plan §21.7 says why.

---

## Phase 10 — Verification

**Goal:** turn claims into artifacts a judge can check.

**Read:** plan §14 (all), §21.2, §21.4, §21.5, §12.4.

**Build:**
- ~30-case eval suite across all five scenarios, with `mustNotCall` assertions.
- The tool-description ablation: naive draft vs. tuned, both numbers published to
  `evals/RESULTS.md`.
- GitHub Actions: determinism, tool contracts, correlation contract, evals, Lighthouse CI.
- Lighthouse Agentic Browsing: all checks passing; `llms.txt`; accessibility pass.

**Done when:**
- [ ] CI green, badge in README.
- [ ] `evals/RESULTS.md` committed with per-scenario pass rates and the ablation.
- [ ] Lighthouse Agentic Browsing fraction recorded and screenshotted.
- [ ] Manual end-to-end pass on all five scenarios in **both** judge browsers.

---

## Phase 11 — Submission

**Goal:** ship it.

**Read:** plan §19, §20, §21.9, §21.10.

**Build:** visual polish, empty/error/loading states, README, `docs/ARCHITECTURE.md`,
`docs/WEBMCP.md`, `docs/SECURITY.md`, `docs/SPEC-FEEDBACK.md`, MIT `LICENSE`, demo video.

**Done when:**
- [ ] Video is under 2:45 with audio, matching plan §19.
- [ ] README documents both browser paths and the scenario/seed parameters.
- [ ] `LICENSE` detectable in the GitHub About panel.
- [ ] Submission text covers all four points in plan §20.
- [ ] Plan §21.10 disclaimers are present and honest.

---

## Phase 12 — Tier 3 (optional)

**Only if Phases 0–11 are complete and polished.** Plan §23.

**Read:** plan §21.6, §21.8, §23.

**Build:** cross-origin vendor status page on a second Netlify origin (`exposedTo`,
`getTools({fromOrigins})`, `allow="tools"`, second origin trial token), the in-app `/tools` page,
extended telemetry, Lighthouse work beyond correctness.

**Do not:** start this if anything in Phases 0–11 is unfinished. It is additive by design.
