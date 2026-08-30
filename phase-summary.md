# Phase summary — build state of record

**Read this first, before `phase.md` or `implementation-plan.md`.**

This file is the memory between sessions. If it disagrees with the plan, **this file is right** —
the plan describes intent, this describes what actually happened.

---

## NEXT ACTION

> **Phase 0 — done. Start Phase 1 (simulation core).** Both required surfaces verified: ChatGPT
> in-app browser (exact data match) and Chrome + flag (via the Model Context Protocol Inspector
> extension's Execute Tool). Origin trial token registration is in progress in parallel — not a
> blocker, wire it in via `apps/web/index.html` whenever the token arrives. Read plan §3 and §4
> before starting Phase 1.

**Live URL:** https://incident-commander-461.netlify.app
**Repo:** https://github.com/PurpleWizard07/incident-commander
**Netlify admin:** https://app.netlify.com/projects/incident-commander-461

---

## What needs you (recurring — not just Phase 0)

Two categories recur across every phase. Read this once; it explains why a session will keep
stopping at the same two walls.

1. **Anything needing your Google/Chrome or ChatGPT account.** WebMCP origin trial registration is
   at **https://developers.chrome.com/origintrials** — search "WebMCP", register the production
   origin (`https://incident-commander-461.netlify.app`), and paste the token into
   `apps/web/index.html` where it's already commented in, replacing `PASTE_TOKEN_HERE`. Netlify's
   custom domain add (if you ever want one) is the same kind of step.
2. **Browser verification.** No browser-automation tool is available in this environment — Claude
   cannot open Chrome or the ChatGPT app and click things. Every phase that changes tool
   registration needs you to actually check the ChatGPT in-app browser (P0) and Chrome with the
   flag (P1) and report back what happened. This is not a one-time Phase 0 cost — plan §14.5
   requires it after every registration change, and phase.md repeats the requirement in Phases 0,
   5, 6, 7, and 10.

   **How to test Chrome-side (no version number matters, and no built-in Chrome chat agent exists
   yet):** install the **Model Context Protocol Inspector extension**
   ([beaufortfrancois/model-context-tool-inspector](https://github.com/beaufortfrancois/model-context-tool-inspector)).
   Its **"Execute Tool"** mode manually invokes a registered tool with input you supply — no LLM
   involved, pure proof the registration/execution pipeline works, and this is the primary way to
   verify Chrome-side, not a fallback. Its **"Interact with page"** mode adds an LLM loop on top (an
   API key you supply) for a closer analog to natural-language use — nice to have, not required;
   Gemini API access has a known, currently-unresolved-by-self-service 403 issue for some
   accounts/projects (see Known Issues) that's on Google's side, not ours.

Everything else — code, scaffolding, `gh`/`git`/`pnpm`/`netlify` CLI operations, local builds,
deploys once Netlify is authenticated — Claude can do unattended.

---

## Phase status

| # | Phase | Status | Commit | Notes |
|---|---|---|---|---|
| 0 | Proof (go/no-go) | ✅ done | `2e13f94`..`5f82e12` | ChatGPT in-app browser + Chrome (flag, via Inspector extension) verified by user; origin trial token registered, decoded, wired in, and live on production |
| 1 | Simulation core | ⬜ not started | — | |
| 2 | Backend and store | ⬜ not started | — | |
| 3 | Investigation tool surface | ⬜ not started | — | |
| 4 | Console shell | ⬜ not started | — | |
| 5 | Shared context | ⬜ not started | — | |
| 6 | Authority | ⬜ not started | — | |
| 7 | Dynamic surface | ⬜ not started | — | |
| 8 | Scenarios 2–5 and confidence | ⬜ not started | — | |
| 9 | Supporting sections | ⬜ not started | — | |
| 10 | Verification | ⬜ not started | — | |
| 11 | Submission | ⬜ not started | — | |
| 12 | Tier 3 (optional) | ⬜ not started | — | |

Status values: ⬜ not started · 🟡 in progress · ✅ done · ⚠️ done with caveats (say what in Notes)

---

## Decisions log

Every decision made during the build that the plan does not already specify. **Append as you make
them, not at end of phase** — this is the part that gets lost, and a future session will otherwise
contradict it.

One line each: what was decided, and why.

| Date | Phase | Decision | Why |
|---|---|---|---|
| 2026-08-30 | 0 | GitHub repo created under `PurpleWizard07`, not the gh-active `DragonDream07` | User's explicit choice — matches the git commit identity already configured globally |
| 2026-08-30 | 0 | Netlify Functions written in the **v2 format** (`export default async (req: Request) => ...` + `export const config = { path }`), not the classic `handler` export | Simpler Request/Response API, and `config.path` sets the route directly without needing a `netlify.toml` redirect rule |
| 2026-08-30 | 0 | `esbuild`'s postinstall needed explicit approval: added `onlyBuiltDependencies: [esbuild]` to `pnpm-workspace.yaml`, then ran `pnpm approve-builds --all` | Recent pnpm blocks dependency postinstall scripts by default. pnpm itself rewrote the key to `allowBuilds: { esbuild: true }` — that's pnpm's own doing, not a mistake, leave it |
| 2026-08-30 | 0 | Ambient `document.modelContext` types live in `packages/shared/src/webmcp-dom.d.ts`, pulled in via a `/// <reference path=...>` in `packages/shared/src/index.ts` | A `declare global` block in a sibling file is NOT automatically included by a consumer's `tsc` just because the package is a dependency — it must be reachable from the imported entry point. The triple-slash reference is what makes it transitive |
| 2026-08-30 | 0 | **Netlify site name is `incident-commander-461`**, not `incident-commander` (auto-suffixed — name was taken) | Cosmetic only. Full URL: https://incident-commander-461.netlify.app. Rename later via the Netlify dashboard if desired — not worth doing now |
| 2026-08-30 | 0 | Manual deploys from this repo **require** `--filter @incident-commander/web` on every `netlify` CLI command, and `--functions` must be an **absolute path** | See Known Issues below — this is a real gotcha that will bite again on every future deploy unless a future session reads this |
| 2026-08-31 | 0 | **Stop targeting "Chrome 156" as a specific version anywhere.** Corrected in CLAUDE.md and phase.md. | User's screenshot of the origin trial registration form showed stable Chrome was at v152 on this date, with the trial covering v149–156 and running through **2026-11-17** — a fixed end date well past our deadline. "156" was always just the top of that range, never a version to chase; the hackathon's own rules only ever said "Chrome with the flag enabled," no version. A future session must not waste time hunting for Chrome 156 |
| 2026-08-31 | 0 | **The Model Context Protocol Inspector extension is the primary way to test Chrome-side, not a fallback.** Documented in CLAUDE.md, phase.md, and "What needs you" above. | Chrome ships no built-in chat agent yet (Gemini-in-Chrome WebMCP support is announced, not shipped, as of this date). Its "Execute Tool" mode manually calls a registered tool — proving registration/execution without needing any LLM in the loop at all |

Examples of what belongs here: naming schemes, library version pins that mattered, a workaround for
browser behaviour, a data-shape change, anything where a reasonable person would have chosen
differently.

---

## Deviations from the plan

Where reality contradicted `implementation-plan.md`. **Also update the plan itself** — never leave it
describing something untrue.

| Phase | Plan section | What the plan says | What we actually did | Plan updated? |
|---|---|---|---|---|
| — | — | *(none yet)* | | |

---

## Known issues / deferred

Things that are broken, ugly, or postponed, so a later session does not rediscover them as surprises.

| Phase found | Issue | Severity | Plan |
|---|---|---|---|
| 0 | **Netlify CLI's monorepo prompt is interactive and cannot be answered non-interactively.** Any `netlify` command run from the repo root (which has 3 workspace `package.json`s) opens a "Select the project you want to work with" prompt and **crashes** (`ERR_USE_AFTER_CLOSE`) if stdin isn't a TTY. Fix: always pass `--filter @incident-commander/web` to bypass it. | Medium — silent trap for a future session that doesn't know this | Not in plan; recorded here only |
| 0 | Because of the above, `--filter`'s implied base directory (`apps/web`) silently breaks **relative** `--dir`/`--functions` paths — a relative `--functions apps/api/src/functions` got joined onto `apps/web/`, resolved to a nonexistent folder, and **the CLI deployed successfully with zero functions and no error**. Always use an absolute path for `--functions` on manual deploys. The exact command that works: `netlify deploy --filter @incident-commander/web --no-build --dir apps/web/dist --functions "C:/Users/varad/OneDrive/Desktop/webmcp/apps/api/src/functions" --prod` | **High** — fails silently, not loudly | Not in plan; recorded here only |
| 0 | No git-based CI/CD is wired up. Every deploy so far is a manual local `pnpm --filter web build` + `netlify deploy --prod` run by Claude. Netlify's dashboard could auto-deploy on push instead, which would sidestep the `--filter` gotcha above entirely (server-side builds don't go through the interactive CLI) — but wiring that up needs one dashboard click to authorize Netlify's GitHub App, so it needs the user. Deferred; not blocking, since manual deploys work | Low | Consider before Phase 8+, once deploys become frequent |
| 0 | ~~WebMCP origin trial token not yet registered~~ **Resolved 2026-08-31** — token registered, decoded and verified, wired into `index.html`, deployed to production. Flag-free Chrome path not yet re-tested by a human in an actual browser (only confirmed via curl that the meta tag is present) — worth a quick check next time Chrome is open, not blocking | Low | plan §21.1 |
| 0 | **Gemini API 403 "Your project has been denied access" / PERMISSION_DENIED.** Hit when the user tried the Inspector extension's "Interact with page" mode with a fresh AI Studio key. Widely reported on Google's own AI Developer Forum as a project-level restriction Google applies silently; self-service fixes (billing, region, fresh project) don't reliably clear it — their own guidance is "contact support." Not our bug, not blocking (Execute Tool mode already proved the pipeline works without any LLM) | Low — cosmetic, optional test path only | N/A, external to this project |

---

## Browser verification log

The riskiest unknown in the project. Re-verify after any change to tool registration.

| Date | Build | ChatGPT in-app | Chrome (OT token) | Chrome (flag / extension) | Notes |
|---|---|---|---|---|---|
| 2026-08-31 | `2e13f94` | ✅ pass | ⬜ not registered yet | ✅ pass | ChatGPT: agent reported checkout errorRate 0.64/baseline 0.005, latencyP95 260/baseline 240 — exact match to hardcoded data, confirms real execution not a hallucinated guess. Chrome: verified via Model Context Protocol Inspector's "Execute Tool," stable channel was v152 (flag-enabled) |
| 2026-08-31 | `5f82e12` | — | ✅ token wired in, deployed, meta tag confirmed live on production | — | Token decoded before embedding: `{origin: https://incident-commander-461.netlify.app:443, feature: WebMCP, expiry: 2026-11-17}` — matches exactly. Not yet re-tested flag-free in an actual browser; do that opportunistically, not blocking |

---

## How to update this file

At the end of a phase:

1. Set its row to ✅ (or ⚠️ with a caveat), add the commit SHA.
2. Update **NEXT ACTION** to the next phase's first concrete step.
3. Move anything unfinished into *Known issues / deferred*.
4. Confirm the decisions log captured everything non-obvious from the phase.

During a phase, whenever you decide something the plan does not cover, or discover the plan is
wrong: append to the relevant table immediately and commit. Do not batch it to the end — a lost
session loses exactly the work that was never written down.
