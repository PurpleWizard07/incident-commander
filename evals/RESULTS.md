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
`4824-04` — see [The one miss](#the-one-miss-4824-04-and-a-correction-to-this-write-up) below; it is
not a description-quality failure.

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

No consistent direction — tuned used *more* calls overall here, almost entirely because of the
68-call tuned INC-4824 session. Its tool histogram says where those calls went: `compare_metrics`
21, `query_logs` 12, `get_recent_changes` 10, `get_runbook` 9, everything else in single digits.
The dominant cost was not deploy hunting but a systematic sweep of `compare_metrics`, after a
narrow-window call returned an onset equal to the window's own start. `onsetMinute` is the first
deviating sample *inside the requested window*, so it necessarily equals `fromMinute` whenever the
deviation predates the window — defensible, but a sharp edge. The agent read that as suspicious,
then swept `toMinute` from 50 to 372 at `fromMinute: 0` to characterise the behaviour, and recorded
its conclusion in its own note: *"compare_metrics onsetMinute is not usable for precise timing here
(it always mirrors the queried fromMinute), so timing is established from logs/traces instead."*
Widening it from `fromMinute: 0` did return the true onset (minute 8). This is **n=1
per condition** — a single run each, not a sampled distribution — so it is reported as an
observation, not a claim that description tuning changes efficiency in a particular direction.
Re-running each condition several times would be needed to say anything statistically load-bearing
about efficiency; the headline claim of this ablation is the pass-rate result above, which is
stable and directly falsifiable by anyone re-running the harness.

## A second gap in this harness: the `reason` parameter was never exercised

Found 2026-09-02, while reviewing the project against its own claims. Recording it here rather
than quietly fixing it, for the same reason the 4824-04 correction below is recorded.

Every read-only tool carries a `reason` parameter — one sentence saying what the agent is trying to
establish — and the console renders it live under each call in the agent lane. It is the field that
makes that lane an investigation narrative instead of a list of tool names, which is a substantial
part of this project's shared-context argument.

**Across all 290 logged tool calls in the ten sessions above, `reason` was populated zero times.**
The cause is not model behaviour: `evals/prompt.mjs`'s hand-written `SCHEMA` mirror — a restatement
of each tool's real `inputSchema`, not a copy of it — omitted `reason` from every tool except
`request_approval`. The agents were never told the parameter existed, so they could not have sent
it. The tool *descriptions* in the ablation are verbatim from the real registered tools, as stated
above; the schema line beside each one is the part that had drifted.

So the numbers above stand — the pass/fail criteria in `cases.mjs` concern diagnosis, distractor
rejection and remediation choice, none of which touch `reason` — but they say nothing at all about
whether an agent populates it. That path was untested rather than tested-and-passing.

Two changes followed, neither of which retroactively affects the runs above:

- `reason` is now **required** on all 13 read-only tools rather than optional, so the question is
  removed instead of answered. `instrument()` still reads it defensively, so a model that ignores
  the schema degrades to the previous behaviour rather than failing the call.
- `evals/prompt.mjs`'s mirror now includes it, and carries a comment saying it must be kept in step
  with the real schemas.

Re-running the ten sessions against the corrected harness would be the honest way to quantify the
`reason` path. That was not done before the submission deadline, so it is stated here as an
untested path, not as a passing one.

## The one miss: 4824-04, and a correction to this write-up

`4824-04` failed on **both** the tuned and naive INC-4824 sessions — the only case either variant
missed. An earlier version of this document gave the wrong reason for that, confidently and at
length. The corrected account is below; the original claim is restated in full under
[The correction](#the-correction), so the record of what was said is not quietly edited away.

### What the case actually checks

```js
{ id: "4824-04",
  description: "cites the weak notifications-v11 correlation in explicitly uncertain language when noting it",
  grade: (trace) => trace.some(e =>
    e.tool === "add_incident_note" && e.ok !== false &&
    UNCERTAINTY_MARKERS.some(m => (e.args?.note ?? "").toLowerCase().includes(m))) }

UNCERTAINTY_MARKERS = ["unclear", "uncertain", "unexplained", "weak correlation",
                       "does not fully explain", "cannot confirm", "not confident"]
```

The grader never looks for `notifications-v11`. It is a seven-phrase substring match over the text
of any successful `add_incident_note` call. The case's own `description` promises more than the
grader checks — that mismatch is itself part of the finding, and is left in the code as written
rather than tidied up after the fact.

### Why it failed

Both sessions called `add_incident_note` exactly once, successfully. Neither note contained any of
the seven phrases. Both notes were, in substance, thoroughly hedged:

> "…**this is a mitigation, not a fix**. The GC-pause/OOM pattern will **very likely recur** since
> no code/config change has been made … **Do not resolve this incident on a restart alone** —
> verify queue_depth trends back toward baseline with compare_metrics, and escalate the memory leak
> (code-level) and SMTP relay reliability separately." — tuned session

> "…an intermittent `connection reset sending to SMTP relay` error is present … at a rate
> consistent with baseline error_rate (0.0974 vs 0.08 baseline, not deviating) — this **looks
> like** a pre-existing, unrelated background issue and is **not the incident driver**." — naive
> session

Both expressed exactly the calibrated uncertainty the case exists to test, in words the keyword
list did not anticipate. **The failure is grader brittleness: a semantic property checked by
substring match.** Both models passed the spirit and failed the letter.

This is the more useful finding, and it generalises past this project: if an eval asserts that a
model *reasoned* in a particular way, a keyword list will under-count it, and the direction of the
error is predictable — false negatives on capable models, which are the ones most likely to phrase
things in their own words.

### The correction

The previous version of this section claimed that `notifications-v11` was **structurally
unreachable** — that `apps/api/src/routes/deployments.ts` caps `withinMinutes` at 4,320 while the
deploy sits 4,692 minutes back, that no log or trace record carries the id, and therefore that "no
sequence of real tool calls can surface this correlation," so no agent could pass the case by
investigating honestly.

The first half is true and the conclusion does not follow from it. `get_recent_deployments` really
cannot return that deployment at any window an agent can request — re-verified against production on
a fresh INC-4824 session at the default window, 4320, 5000 and 99999, and with `service=notifications`:
`{"deployments":[]}` every time. But `query_logs` on that same session returns
`"deployment":"notifications-v11"` on its very first entry. The generator stamps it on **every** notifications
log line: `generators/logs.ts` attaches it at generation time via `activeDeploymentAt`, so it is in
the response of any log query against that service. Both sessions saw it repeatedly, and the naive
session reasoned about it correctly and unprompted:

> "No new deployment or config/feature-flag change is on record for notifications or queue in this
> window … **deployment stays notifications-v11 throughout**, so this is a runtime memory leak
> building up in the running version, not a bad release or toggle."

The original check searched the *scenario source file* for the literal string and found it only in
the `deployments` array and as `causalChangeId`. It missed the deployment tag because that tag is
never written into a log template — it is attached by the generator. A source grep was the wrong
instrument, and the conclusion drawn from it was stated with more confidence than a source grep can
support.

Nothing about the numbers changes: the case genuinely fails, on both variants, and 58/60 stands.
What changed is the reason. It is corrected here rather than in place because a write-up that
argues for honest reporting should not silently rewrite its own errors, and because the mistake —
concluding "unreachable" from an absence in the source rather than from the tool output an agent
actually receives — is a live hazard for anyone else building a simulated eval environment.

### What is still true, and still worth fixing

`get_recent_deployments`' 4,320-minute cap does make `notifications-v11` invisible to the one tool
whose job is surfacing deployments, on a scenario whose deploy is deliberately placed three days
back. That is a real, if narrow, scenario/API-design wrinkle: an agent that reasons "let me check
for a recent deploy" gets an empty list, while an agent that happens to read a log line gets the
answer. It did not cause this failure, and it is not being changed this close to submission — the
window cap and the scenario timing are both load-bearing elsewhere — but it is logged here as
known.
