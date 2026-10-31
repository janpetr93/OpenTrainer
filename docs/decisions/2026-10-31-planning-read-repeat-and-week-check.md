---
date: 2026-10-31
status: active
---

# Planning reads a summary, repeats steps, and checks the week

## Context

The intensity doctrine in `plan_training_week` asked the model to sum TSS and time-in-zone from `list_activities`. That tool returns 1 Hz **Power Profile**s, which is enough data to crowd out the rules. A 30 s / 15 s session is also dozens of steps if written out one rep at a time. `set_training_intent` replaced the whole **Training Intent**, so a note update cleared `maxHardDaysPerWeek`.

## Decision

- Add MCP `get_training_summary`: per-**Activity** load, adherence, prescription kind, and compact **Workout** steps, plus a rollup. No samples. `list_activities` stays for the raw ride.
- Add a **Workout Repeat** (`type: "repeat"`, `count`, inner steps, one level). The planned **Power Profile** and the runner expand it. Stored form stays compact.
- Add MCP `check_training_week`. It reports hard days over the cap, hard days with no easy day between them, a third session in the 76–94% FTP band, and zone 6–7 or other steps the doctrine forbids. It does not block the write.
- `set_training_intent` keeps omitted fields. Explicit null clears a field. `goal` is required only when Intent is unset.

## Alternatives considered

- **Strip samples inside `list_activities`** — rejected. History and debugging still need the profiles; planning gets a separate read.
- **Expand repeats when the Workout is saved** — rejected. The next week’s plan would have to count expanded reps to add one.
- **Reject a week that fails the check** — rejected. The model should see the violations and fix them; a hard reject is a worse recovery path when the rider asked for an exception.

## Consequences

- Kind on a planned ride comes from steady steps (sweet spot and above, or a short-interval set), not from how the ride was actually ridden. Achieved zone time is still in the rollup. A **Free Ride** is hard when zones 4–7 total at least five minutes.
- Warmup and cooldown steps are not counted as the 76–94% band, so a stepped warmup near 80% FTP does not make a HIT day “moderate”.
- The ~6 hour split and the 0.85 adherence downshift stay in the prompt. The check enforces the structural caps, not the hours split.
