# Incident Commander — project entry point

WebMCP Challenge submission. A production incident response console where an AI agent investigates
through structured WebMCP tools while the human watches the same evidence in the same UI and retains
authority over production changes.

**Deadline: 2026-09-03, 1:00 pm PT.** Judges test the live URL in ChatGPT's in-app browser or
Chrome 156.

## Read these, in this order

1. **`phase-summary.md`** — what is already done, and the single next action. **Always read first.**
2. **`phase.md`** — the current phase: what to build, what "done" means, and which plan sections to
   read for it.
3. **`implementation-plan.md`** — 2,200 lines. **Do not read whole.** Read only the sections the
   current phase names.

Background, read only if you need the *why*: `incident-commander.md` (original concept),
`incident-commander-review.md` (external review), `details.md` (hackathon rules).

## Standing rules

These are settled decisions. Do not relitigate or "improve" them without being asked:

- **No SSE, no SQLite, no Fastify.** State is event-sourced on Netlify Blobs; the console polls.
  This was a deliberate fix for a real serverless bug — see plan §2.1 and §2.2.
- **Tool surface is fixed at 23 imperative + 2 declarative**, each audited in plan §6.7. Do not add
  tools. Do not remove tools.
- **Every tool response must fit 1.5K characters.** Use the shaper in plan §6.6.
- **Wrong actions must visibly fail.** The default remediation effect is `no_effect` (plan §4.6).
  Never make an action succeed to make a demo smoother.
- **`scenarioId` and ground truth never appear in any API response or tool output.** Plan §3.9.
- **Priority is governed by plan §23 tiers.** Tier 3 is built only if Tiers 1 and 2 are complete.
- **ChatGPT in-app browser is the P0 test surface**, not Chrome DevTools. Plan §14.5.

## Working agreement

- Commit at every phase boundary, and after any non-trivial decision.
- When you make a decision the plan does not cover, append it to `phase-summary.md` **immediately**,
  not at end of phase.
- If reality contradicts the plan, update `implementation-plan.md` and note it in the summary. Do not
  leave the plan describing something that is no longer true.
