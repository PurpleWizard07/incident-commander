# WebMCP spec feedback

Observations from actually building against `document.modelContext`, not feature requests. We hit
real edges in four places the explainer itself names as open questions.

## 1. Progress reporting for long-running tools

`rollback_deployment`, `restart_service`, and `scale_service` don't complete instantly — a real
rollback recovers over minutes, not milliseconds. Our `execute()` returns as soon as the action is
*accepted*, with a `recoveryCurve` describing how the metrics should move afterward, and the
console animates that curve client-side by re-polling `/api/state`. There's no way to report that
progress back through the tool call itself — no incremental-result channel, no "still running"
signal distinct from a plain resolved promise. An agent calling `rollback_deployment` gets one
message back ("Rollback initiated, recovery expected over ~8 minutes — verify with
`compare_metrics`") and has to know, out of band, that it should poll rather than assume the fix is
already in effect. A progress-reporting primitive (even a simple one — periodic
`tool-progress`-style events tied to the call) would let an agent distinguish "accepted and still
recovering" from "done" without inventing a polling convention itself.

## 2. Output schemas

`inputSchema` is well-specified; there's no equivalent for a tool's output. We hand-rolled response
shaping ourselves (compact plain-text summaries, capped at 1.5K characters, described in our own
tool descriptions rather than machine-checkable) because there's no structured output contract to
declare and validate against. This is workable for a single first-party console, but it means an
agent has no way to know a tool's response *shape* except by reading the description prose or
calling it and inspecting the result — the same problem `inputSchema` already solved on the input
side.

## 3. Tool-initiated user prompting / elicitation

Our sharpest security question was: an agent that can call `request_approval` and then
`record_approval` has no authorization boundary at all. We solved it entirely outside the WebMCP
surface — a server-minted, single-use approval token that only a real, `isTrusted` click in the
console UI can produce, with `record_approval` unconditionally denying any agent-supplied token.
That works, but it's a workaround for the platform having no elicitation primitive: no way for a
tool to say "this call requires a human decision before it can proceed," and no first-class way for
the *page* (not the model) to be the one asked. A built-in mechanism for "this tool call must be
confirmed by a real user gesture, and here's the UI surface that will collect it" would replace a
bespoke HMAC-nonce scheme with something the platform itself guarantees.

## 4. Skills coordinating multiple tools

A real investigation is a recognizable sequence — check service health, check dependencies, check
recent deployments and changes, compare metrics for onset ordering, check a runbook, then propose a
remediation — that we can only express as separate tool descriptions each nudging the agent toward
the next one ("If this returns nothing, call X instead"). There's no way to declare that sequence as
a first-class, discoverable unit — a "skill" that groups and orders several tools with its own
description, distinct from the 23 individual tool entries an agent has to reconstruct the workflow
from every time. We got a reasonable result through careful per-tool cross-referencing (verified in
the eval ablation, `evals/RESULTS.md`), but that's compensating for the absence of the primitive,
not evidence that it isn't needed — a model that reconstructs the right investigation sequence
purely from prose hints is doing more inference work than a declared skill would require.
