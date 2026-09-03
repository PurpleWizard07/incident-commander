# WebMCP spec feedback

Observations from actually building against `document.modelContext`, not feature requests. Sections
1–4 are missing primitives — real edges in four places the explainer itself names as open questions.
Sections 5–6 are implementation edges we hit head-first: both cost real debugging time, both fail in
ways that look like something else, and both would be cheap to document.

## 1. Progress reporting for long-running tools

`rollback_deployment`, `restart_service`, and `scale_service` don't complete instantly — a real
rollback recovers over minutes, not milliseconds. Our `execute()` returns as soon as the action is
*accepted*, with a `recoveryCurve` describing how the metrics should move afterward, and the
console animates that curve client-side by re-polling `/api/state`. There's no way to report that
progress back through the tool call itself — no incremental-result channel, no "still running"
signal distinct from a plain resolved promise. An agent calling `rollback_deployment` gets one
message back (the action's outcome plus "Verify with compare_metrics before resolving") and has to
know, out of band, that it should poll rather than assume the fix is already in effect. A
progress-reporting primitive (even a simple one — periodic `tool-progress`-style events tied to the
call) would let an agent distinguish "accepted and still recovering" from "done" without inventing a
polling convention itself.

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
surface, and the shape of the workaround is the feedback.

There is no way to say "this tool call requires a human decision before it can proceed," so the
gesture requirement has to be smuggled in as an *argument*: `record_approval` takes an
`approvalToken`, and the only endpoint that issues one is deliberately not registered as a tool. An
agent therefore has no path from "I want this" to "this is approved" — but the mechanism is a
bespoke single-use-token dance across two of our own HTTP endpoints, and its security rests on a
negative (*we did not register that one*) rather than on anything the platform enforces. Full model,
including what it does and does not rule out, in [`SECURITY.md`](SECURITY.md).

A built-in mechanism for "this tool call must be confirmed by a real user gesture, and here's the UI
surface that will collect it" would replace that with something the platform itself guarantees. Two
things would have to come with it to be worth using: the confirmation must be attributable to a
genuine user gesture (an agent-synthesized click must not satisfy it), and the *page* — not the model
— must be the one that decides what the confirmation UI says, because in our case that UI is the
evidence the human is deciding on.

## 4. Skills coordinating multiple tools

A real investigation is a recognizable sequence — check service health, check dependencies, check
recent deployments and changes, compare metrics for onset ordering, check a runbook, then propose a
remediation — that we can only express as separate tool descriptions each nudging the agent toward
the next one ("If this returns nothing, call X instead"). There's no way to declare that sequence as
a first-class, discoverable unit — a "skill" that groups and orders several tools with its own
description, distinct from the 23 individual tool entries an agent has to reconstruct the workflow
from every time. We got a reasonable result through careful per-tool cross-referencing (verified in
the eval ablation, [`evals/RESULTS.md`](../evals/RESULTS.md)), but that's compensating for the
absence of the primitive, not evidence that it isn't needed — a model that reconstructs the right
investigation sequence purely from prose hints is doing more inference work than a declared skill
would require.

## 5. A third-party origin trial token is rejected in a static `<meta>` tag

Registering the origin trial through the standard flow, we took a token with third-party matching
enabled — reasonably, since "third-party" sounds like the more permissive option. Chrome rejects
such a token when it arrives in a static `<meta http-equiv="origin-trial">` on a first-party page:
`isThirdParty: true` describes a script embedded on *other* sites, and Chrome expects the token to
be injected at runtime by that script so it can be validated against the script's origin.

The failure mode is what made this expensive. The page simply has no `document.modelContext`, which
at the JS level is indistinguishable from "this browser doesn't support WebMCP" or "the flag isn't
enabled" — so the flag stays on, everything works, and the trial appears to be doing nothing while
looking correctly configured. Re-registering as a plain first-party token fixed it immediately, and
the tools now register with no flag at all on Chrome 149–156.

Two things would have prevented it: saying plainly in the WebMCP origin-trial instructions that a
`<meta>`-tag deployment needs a first-party token, and surfacing a rejected token where someone
debugging a missing `document.modelContext` would actually look.

## 6. Declarative and imperative registration collide on the tool name

Two of our tools (`add_incident_note`, `create_incident`) are `<form toolname="…">` elements because
a human fills those same forms by hand. They started out registered imperatively as well — the same
names, the same handlers — which throws `InvalidStateError: Duplicate tool name` at runtime.

That's defensible behaviour, and arguably the safest default. But the ordering makes it easy to hit
by accident: a declarative form parses on mount, before any `useEffect` runs, so an imperative
registration of a name that a form on the same page already claims always loses, and the error
surfaces from `registerTool()`'s returned promise — easy to leave as an unhandled rejection if you
assumed registration was synchronous and infallible. What's missing is a way to ask the question
before answering it: no way to enumerate names already claimed declaratively, no upsert or
`replace: true`, and nothing in the explainer about which form of registration wins. We resolved it
by making those two declarative-only and documenting the constraint
([`WEBMCP.md`](WEBMCP.md)), but we found it by hitting it in a real browser, not by reading the spec.
