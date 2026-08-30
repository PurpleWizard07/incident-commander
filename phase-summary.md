# Phase summary — build state of record

**Read this first, before `phase.md` or `implementation-plan.md`.**

This file is the memory between sessions. If it disagrees with the plan, **this file is right** —
the plan describes intent, this describes what actually happened.

---

## NEXT ACTION

> **Phase 0 — Proof.** Nothing built yet. Start with `git init` and the workspace skeleton, then get
> one tool live and verified in the ChatGPT in-app browser before anything else.

---

## Phase status

| # | Phase | Status | Commit | Notes |
|---|---|---|---|---|
| 0 | Proof (go/no-go) | ⬜ not started | — | |
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
| — | — | *(none yet)* | |

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
| — | *(none yet)* | | |

---

## Browser verification log

The riskiest unknown in the project. Re-verify after any change to tool registration.

| Date | Build | ChatGPT in-app | Chrome 156 (OT token) | Chrome 156 (flag) | Notes |
|---|---|---|---|---|---|
| — | — | — | — | — | |

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
