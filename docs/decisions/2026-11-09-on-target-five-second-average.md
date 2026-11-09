---
date: 2026-11-09
status: active
---

# On-target scores a 5-second average

## Context

**Session Adherence** counted every raw second inside `|Δ| ≤ max(15% × target, 20W)`. Recent ERG rides sat on the target in the median and in the step average, and still scored about 70–80% On-target. On 9 Nov (Long endurance 90 min, ridden at 105%) the main block was 136 W median against 137 W and On-target was 74%. On 7 Nov (Easy endurance) the median matched 128 W and On-target was 70%. On 4 Nov the 190 W efforts had a 190 W median and the ride scored 72%. Absolute error was centered on zero (median |Δ| about 11–14 W); the misses were pedal and ERG wobble, not a missed block. Widening the band to ±25% / 30 W only reached about 90% on that 90-minute ride.

The History chart already draws measured watts as a 5-second centered average. The number next to it was scoring the unsmoothed samples.

## Decision

Keep the band. Score each second from a centered 5-second average of achieved watts (±2 s on the 1 Hz series). The average stops at a target change, so a step does not borrow watts from the previous step. A target that changes every second is scored raw. `completionRatio` and `intensityPercent` are unchanged.

Startup backfill rewrites stored **Session Adherence** when `sessionAdherenceRevision` is not `2`. That field stays on the Activity file and off the API object. New saves stamp revision 2.

## Alternatives considered

- **Widen the band** — ±25% / 30 W still left a ride whose median was the target at about 90%. The band was already chosen as the ERG tolerance; the sample was the problem.
- **Score the step mean only** — every recent steady block would have been 100%, including the 19 Oct intervals that really sat about 18 W high. A 5-second average leaves those in the mid-80s.
- **Smooth across step changes** — the first seconds of a new target would be pulled toward the previous step and counted as misses.
- **Leave stored scores and apply the formula only to new Activities** — History would keep showing the number this change is meant to correct.

## Consequences

- On-target on a held ERG ride moves from about 70–80% into the low-to-mid 90s. A sustained miss stays off target. The 9 Oct alternating 50 W / 300 W ride stays near 16% because each second's window is only itself.
- `plan_training_week` already ignores low `targetAdherence` when choosing the next hard percent. A higher On-target does not add a repeat.
- Related: [session-load-and-adherence](./2026-10-10-session-load-and-adherence.md), [ride-intensity-and-free-ride-targets](./2026-11-04-ride-intensity-and-free-ride-targets.md).
