# Eval results

**Model:** Claude Sonnet 5 (`claude-sonnet-5`), run via the Claude Agent SDK as a general-purpose
subagent — no system prompt beyond the tool documentation and task framing shown to it (see
`evals/prompt.mjs`).

**Method:** real subagents investigating the live production API
(`https://incident-commander-461.netlify.app`), not a canned trace. Each session called
`node evals/invoke.mjs <sessionId> <toolName> '<jsonArgs>'` from the repo root for every tool use;
`invoke.mjs` makes the real HTTP call and mechanically appends `{at, tool, args, ok, result|error}`
to `evals/traces/<sessionId>.jsonl` independent of what the agent later claims it did. Grading
(`evals/grade.mjs`) reads that trace file plus the agent's final structured report and checks both
against `evals/cases.mjs`'s 30 hand-written cases (6 per scenario) — never the agent's own summary
of its behavior. This is a deliberate substitute for Chrome's `webmcp-tools` CLI runner (whose exact
flags and config shape the plan itself left "to be confirmed against the repo when we wire it up");
this harness is fully self-built and independently auditable instead.

Chrome's own `document.modelContext` execution path is verified separately and only
**qualitatively** — manually, end to end, in the ChatGPT in-app browser and in Chrome with the
WebMCP flag, across all five scenarios (see `phase-summary.md`'s Phase 3/8 verification logs).
Conflating that manual pass with these quantified numbers would overclaim; the two are reported
separately on purpose (plan §21.4, §21.10).

## Headline numbers

| | Tuned descriptions | Naive descriptions |
|---|---|---|
| Cases passed | 29 / 30 | 29 / 30 |
| Pass rate | 96.7% | 96.7% |

**58 / 60 cases passed overall (96.7%).** The single miss on each side is the *same* case,
`4824-04` — see [Known-unreachable case](#known-unreachable-case-4824-04) below; it is not a
description-quality failure.

Every `mustNotCall` / distractor-rejection case passed on both variants: no session concluded
`payments` caused INC-4821, took the `payments-v7` decoy in INC-4822, recommended a rollback for
INC-4823's four-day-old deploy, recommended `scale_service` against INC-4825's failing external
provider, or ever called `resolve_incident` mid-investigation.

## Per-scenario / per-variant

| Scenario | Tuned | Naive | Session (tuned) | Session (naive) |
|---|---|---|---|---|
| INC-4821 — checkout-v3 bad deploy | 6/6 | 6/6 | `eval-4821-tuned` | `eval-4821-naive` |
| INC-4822 — DB pool exhaustion, decoy deploy | 6/6 | 6/6 | `eval-4822-tuned` | `eval-4822-naive` |
| INC-4823 — pricing feature-flag rollout | 6/6 | 6/6 | `eval-4823-tuned` | `eval-4823-naive` |
| INC-4824 — notifications memory leak | 5/6 | 5/6 | `eval-4824-tuned` | `eval-4824-naive` |
| INC-4825 — external provider outage | 6/6 | 6/6 | `eval-4825-tuned` | `eval-4825-naive` |

Every session correctly named the causal service, correctly rejected that scenario's built-in
distractor, and recommended the one remediation tool the evidence actually supports (or, for
INC-4825, recognized that no `restart_service`/`scale_service`/`rollback_deployment` action helps
against a failing external dependency).

## The ablation: tuned vs. naive tool descriptions

`evals/tool-descriptions.mjs` holds two variants of all 23 tool descriptions: `TUNED` (verbatim
from the real registered tools — negative clauses, cross-references, explicit empty-result
guidance, per plan §6.1) and `NAIVE` (a deliberately generic one-liner per tool, e.g.
`get_active_incidents: "Get the list of incidents."`). Only the prompt text differs between a
tuned and naive session; the input schemas, task framing, and underlying API are identical.

**Result: no difference in final pass rate (29/30 both sides).** Reported honestly, as plan §21.4
commits to doing either way — "if those sentences turn out not to matter, that is worth reporting
honestly too." With a capable model and unambiguous evidence (every scenario's ground truth is
designed to be recoverable from raw tool output — onset ordering, span attribution, log patterns —
not from tool-description hints alone), Claude Sonnet 5 reached the same diagnosis regardless of
whether it was told `compare_metrics` establishes causal ordering or just that it "compares
metrics." The negative clauses (e.g. "a cause must precede its effect") describe reasoning the
model was already doing, not reasoning it needed prompting into.

**Where a difference did show up: tool-call efficiency, not accuracy.** Total tool calls per
session (from `evals/traces/*.jsonl`, `toolCallCount` in each grade result):

| Scenario | Tuned calls | Naive calls |
|---|---|---|
| INC-4821 | 23 | 24 |
| INC-4822 | 36 | 41 |
| INC-4823 | 15 | 16 |
| INC-4824 | 68 | 31 |
| INC-4825 | 15 | 21 |
| **Total** | **157** | **133** |

No consistent direction — tuned used *more* calls overall here, almost entirely because the tuned
INC-4824 session tried exhaustively wide `withinMinutes`/`type` windows on
`get_recent_deployments`/`get_recent_changes` chasing a correlation that (see below) turns out to
be structurally unreachable, while the naive session gave up on that thread sooner. This is **n=1
per condition** — a single run each, not a sampled distribution — so it is reported as an
observation, not a claim that description tuning changes efficiency in a particular direction.
Re-running each condition several times would be needed to say anything statistically load-bearing
about efficiency; the headline claim of this ablation is the pass-rate result above, which is
stable and directly falsifiable by anyone re-running the harness.

## Known-unreachable case: 4824-04

`4824-04` ("cites the weak notifications-v11 correlation in explicitly uncertain language when
noting it") failed on **both** the tuned and naive INC-4824 sessions — the only case either variant
missed.

Root cause, confirmed directly against the live API: `notifications-v11`
(`packages/sim/src/scenarios/inc-4824-memory-leak.ts`, `DEPLOY_MINUTE = -3 * 24 * 60`, commented
"weak correlation" in the source) sits 4,692 minutes before this scenario's `nowMinute` (372), but
`apps/api/src/routes/deployments.ts` hard-caps `get_recent_deployments`'s `withinMinutes` at
`Math.min(4320, ...)` regardless of what an agent requests. Queried directly at 4320, 5000, and the
default window: empty every time. `get_incident_timeline` (unbounded) does not include it either,
and no log or trace record in the scenario is tagged with `notifications-v11` — the id appears only
in the (unreachable) `deployments` array and as `causalChangeId`, which is ground-truth bookkeeping
never exposed in any API response (per this project's own standing rule). **No sequence of real
tool calls can surface this correlation**, so no agent — however careful, however well-described
its tools — can pass this specific case by investigating for real.

This was almost certainly satisfied during Phase 8's manual verification (phase.md's Phase 8 exit
checklist) by hand-typing a note through the console's own Add Note form to test the confidence
engine's uncertainty-language detection in isolation — a reasonable way to test that mechanism, but
it means this eval case tests something an autonomous investigation cannot actually reach.

Left in the suite and reported as a genuine miss rather than quietly loosened or removed after
seeing it fail, per plan §21.10's honesty commitment. This is a self-found gap in the eval design
(and arguably in `INC-4824`'s scenario data / the deployments window cap), not evidence about tool-
description quality — the other 5 cases on both INC-4824 sessions passed cleanly, including
correctly identifying `notifications` as the cause and correctly declining to resolve the incident.
