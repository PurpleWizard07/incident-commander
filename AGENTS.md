# Incident Commander — project entry point

WebMCP Challenge submission. A production incident response console where an AI agent investigates
through structured WebMCP tools while the human watches the same evidence in the same UI and retains
authority over production changes.

**Deadline: 2026-09-03, 1:00 pm PT.** Judges test the live URL in ChatGPT's in-app browser or
Chrome with `chrome://flags/#enable-webmcp-testing` enabled — per the hackathon's own rules, no
specific version. ("Chrome 156" in earlier notes meant the top of the origin trial's supported
range, 149–156, not a version to target — stable Chrome was at 152 as of 2026-08-31 and will not
reach 156 before the deadline. The trial itself runs through 2026-11-17, well past submission.)
Chrome ships no built-in chat agent yet, so testing tool execution natively needs the
**Model Context Protocol Inspector extension** (Execute Tool = manual call, no LLM needed).

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
  (`World.scenarioId` itself, inside `packages/sim`, is legitimate engine bookkeeping — it is not
  yet a response. The rule is about what Phase 2+ copies into one.)
- **Priority is governed by plan §23 tiers.** Tier 3 is built only if Tiers 1 and 2 are complete.
- **ChatGPT in-app browser is the P0 test surface**, not Chrome DevTools. Plan §14.5.
- **Every independent generation concern (metric series, log template, trace shape) gets its own
  `Rng`, keyed by a stable `id`.** Never thread one shared `Rng` across them sequentially — see
  phase-summary.md's 2026-08-31 Phase 1 entries for the real bug this caused (a past data point's
  value silently depended on how far into the future the world was asked to generate).
- **`node-linker: hoisted` in `pnpm-workspace.yaml` is required — do not remove it or reinstall in a
  way that drops it.** Without it, deployed functions fail at runtime with `Cannot find package`.
  Import our own workspace packages (`sim`, `shared`) via the relative-path shim files
  (`simEngine.ts`/`sharedTypes.ts`), never the bare `@incident-commander/*` specifier, inside
  `apps/api`. **Deploy with the exact command in phase-summary.md's "Deploying this project"
  section** — the flags are all load-bearing and a plausible-looking variant fails silently
  (zero functions deployed, no error) or confusingly (dependency not found at runtime).
- **`netlify dev` does not work on this Windows machine — don't spend time debugging it further.**
  Verify backend changes by deploying and curl-testing production. See phase-summary.md's Phase 2
  Known Issues for why (an `EPERM` symlink permission wall in Netlify's local bundler, unrelated to
  our code and absent on the actual deployed Linux environment).

## Working agreement

- Commit at every phase boundary, and after any non-trivial decision.
- When you make a decision the plan does not cover, append it to `phase-summary.md` **immediately**,
  not at end of phase.
- If reality contradicts the plan, update `implementation-plan.md` and note it in the summary. Do not
  leave the plan describing something that is no longer true.
