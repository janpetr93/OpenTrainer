---
date: 2026-11-12
status: active
supersedes: 2026-11-11-calendar-blocker.md (sport Blocker “no done / no missed” clause only)
---

# Fitness / Fatigue / Form and External Load on Blockers

## Context

Week planning had **Session Load** TSS per bike **Activity** and a **Training Summary** rollup, but no chronic load curve. CTL/ATL/TSB were deferred. Other-sport stress could not enter Form: sport **Blocker**s were calendar marks only (explicitly no done state). The rider’s intended bridge for off-bike work is Garmin → GPT → OpenTrainer MCP, including filling **today** or **yesterday**’s planned Blocker.

## Decision

### Form (coach-first)

- Product language: **Fitness** (CTL), **Fatigue** (ATL), **Form** (TSB = Fitness − Fatigue). Payloads may still expose `ctl` / `atl` / `tsb`.
- Daily TSS = that local day’s bike **Activity** **Session Load** TSS + **External Load** on completed sport **Blocker**s. Planned, skipped, and social Blockers add 0. No projected **Scheduled Ride** TSS in v1.
- Fixed Banister constants: 42-day Fitness, 7-day Fatigue. No profile knobs in v1.
- MCP read: dedicated `get_form` (not folded into `get_training_summary`). Thin Profile UI of the same cache (MMP pattern).
- Soft prompt doctrine only for how Form steers `plan_training_week` / `review_training`. No new `check_training_week` Form violations in v1.
- Always compute from available history; include a reliability / history-depth flag. No PMC seed in v1.
- Recompute automatically when an **Activity** is saved or a sport **Blocker**’s stress-relevant fields change; keep manual Recompute.

### External Load on sport Blockers

- **External Load** is a concept, not a second Local Store collection: explicit `trainingStressScore` on a **completed** sport **Blocker** (MCP-only).
- Sport **Blocker**s gain status `planned` / `completed` / `skipped`. Social Blockers stay occupancy-only.
- No orphan loads: every off-bike TSS rides on a sport Blocker (create already `completed` for spontaneous sessions).
- Completing requires TSS and may also update `durationMin`, label, and/or `startsAt` so the calendar matches what was done (Garmin → GPT → MCP).
- Past `planned` sport Blockers are derived **missed** like **Scheduled Ride**s and remain fillable retrospectively (complete with TSS or skip).
- OpenTrainer does not import Garmin/Strava for this; the AI client is the bridge.
- External Load is TSS-*shaped* stress for Form, not a claim of lab Coggan TSS.
- **Superseded for primary path:** Garmin Training Load 1:1 — see [profile physiology + computed External Load](2026-11-12-profile-physiology-and-computed-external-load.md) (rTSS / hrTSS from Profile anchors + raw session metrics).

## Alternatives considered

- **Form as Profile-only / informational** — rejected: wastes the MCP coaching wedge.
- **Projected plan TSS in the primary CTL** — rejected for v1; optimistic fatigue.
- **Strava/FIT import of other sports before Form** — deferred; GPT bridge is enough for the main user.
- **Separate External Load records / orphan loads** — rejected once completion is 1:1 with sport Blockers.
- **Blocker duration × kind multiplier as automatic TSS** — rejected; explicit TSS via MCP.
- **RPE→TSS formula in companion code** — rejected; heuristic stays in prompts.
- **Form hard-gates in `check_training_week`** — deferred until history and External Load estimates are trusted.
- **Hide Form until 42 days / seed CTL from TrainingPeaks** — rejected; show with reliability flag.
- **Lazy or manual-only Form recompute** — rejected; Garmin fill-in must show up on the next `get_form`.

## Consequences

- Supersedes the “past Blocker has no done / missed state” clause of [calendar-blocker](2026-11-11-calendar-blocker.md) for sport kinds only.
- MCP grows `get_form`, complete/skip (or equivalent) for sport Blockers with TSS + optional fact alignment; planning/review prompts gain Form doctrine and Garmin-fill guidance.
- Calendar UI gains completed vs planned sport Blocker presentation; Profile gains a thin Form read.
- [CONTEXT.md](../../CONTEXT.md) terms: **Fitness**, **Fatigue**, **Form**, **External Load**; **Missed** covers sport Blockers; **Blocker** status updated.
