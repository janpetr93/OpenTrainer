---
date: 2026-11-04
status: active
---

# Ride Intensity mid-workout and target watts in a Free Ride

## Context

A rider in ERG on a Z2 ride or a threshold over-under (FTP 280 W) who is tired after the first interval had two choices: hold every planned watt or Stop and lose the rest of the **Workout**. There was no way to ride, say, 80% of the plan. A **Free Ride** sent no ERG target at all, so the **Trainer** held whatever setpoint the **Control Probe** or the last **Workout** had left. The rider could not see that setpoint or change it.

Changing targets mid-ride also changes what review means. **Session Adherence** scored achieved watts against the planned **Power Profile** with a band of `max(15%, 20 W)`. A rider who chose 80% and held it in ERG would score near 0% on every work interval, as if they had failed the plan.

## Decision

**Ride Intensity (Workout).** The Ride tab gets an intensity control while a **Workout** runs or is paused: −5%, −1%, +1%, +5%, and Reset to 100%. The range is 50–150%. It scales the resolved target of the current step at once, and every later step, until the rider changes it again. The Target tile shows the scaled watts and the original (`224 W · of 280 W`). The ride chart keeps the original plan as its shaded area and adds a **Target** line for the scaled targets.

**Free Ride targets.** A **Free Ride** starts with no target, as before. The first nudge (−25, −5, +5, +25 W) holds the rider's current **Live Power**, rounded to 5 W, plus the nudge. With no fresh power the start is 60% of **FTP**, or 100 W with no FTP. After that the **Trainer** runs ERG at that target (30–1500 W). %FTP is shown next to it when FTP is set. A Free Ride target cannot be switched back off: FTMS has no "release ERG" command short of Reset or simulation mode, and the trainer was already left in ERG before this change.

**Keyboard.** While a ride runs or is paused, keys work on every tab, not only Ride. ↑/↓ or +/− step by 1% (Free Ride: 5 W). Shift+↑/↓ or PageUp/PageDown step by 5% (Free Ride: 25 W). R resets a Workout to 100%. Keys are ignored in text fields, with Ctrl/Cmd/Alt, and on auto-repeat, so a key held down cannot run the target away.

**ERG.** Both modes feed the scaled or set target into the existing ERG push as the step target. In **meter-primary**, **ERG Calibration** and the Assioma trim apply to the scaled target unchanged. The trainer setpoint is still target + learned offset + trim. Rapid presses are combined into one write on the next 250 ms tick, and no new write starts while one is waiting for the trainer to answer.

**What the Activity keeps.**

- `plannedPowerProfile` stays the **Workout** as prescribed (current FTP at Start). Strava step text and `lastHard.work.plannedWatts` keep reading the plan.
- `targetPowerProfile` (new, optional) holds the step corners of the targets the rider actually asked for. For a Workout it is the plan with each Ride Intensity applied from the second it was set, carried to the end of the plan. For a Free Ride it is the targets set, from the first one to Stop. It is null when intensity stayed at 100% and in a Free Ride with no target. The changes over time are the corners of this profile, so no separate change log is stored.
- FTMS setpoints after calibration and trim are not stored. They are device control, not training intent, and the existing `trainerWatts` stream already shows what the trainer did.

**Session Adherence.** `targetAdherence` scores achieved watts against `targetPowerProfile` when present, otherwise against the plan. A rider who chose 80% and held it is on target. A new `intensityPercent` records how much of the plan was asked for: Σ target ÷ Σ planned watts over the seconds ridden. Watts-weighting makes work intervals count more than recoveries. It is present only when a `targetPowerProfile` was saved; absent means the plan ran at 100%. `completionRatio` is unchanged. A Free Ride still has no adherence.

**Session Load** is unchanged. NP, IF, TSS and zone time come from achieved power, which is already honest about a dialled-down ride.

## Alternatives considered

- **Keep scoring against the original plan** — penalises a deliberate choice as a failure and hides how much the rider rode.
- **Score against the targets but drop the intensity** — high adherence would hide that the plan was dialled down. The planner would then progress a session the rider did not do.
- **Rewrite `plannedPowerProfile` with the scaled targets** — loses the prescription. The Strava step text, the chart and `lastHard.work` would all describe a plan nobody wrote.
- **Store a separate list of intensity changes** — duplicates `targetPowerProfile` and can drift from it.
- **Store every FTMS setpoint** — mostly calibration and trim noise, about once per second in meter-primary, and it does not change any review number.
- **Free Ride target in %FTP** — watts are what the rider reads on the Target tile and what ERG holds. %FTP is shown beside it instead.

## Consequences

- MCP `get_training_summary` and `list_activities` carry `adherence.intensityPercent` (absent at 100% and on older Activities). `lastHard.work.averageWatts` is still the watts held against the original plan. A ride dialled down to 80% therefore reads as "lower average: keep percentFtp, no extra repeat", which is the honest outcome.
- History rows show `Intensity 80%` when a ride was not at 100%. Their chart shows the Target line alongside Plan and Power.
- The Strava description adds `Ridden at 80% of plan` under the planned steps when intensity was not 100%.
- No FTMS command was added. `trainerConnection.ts` is unchanged, so this can merge cleanly with the Bluetooth device memory change.
- Intensity resets to 100% at each Start. It is not remembered between rides or set before Start.
- Not verified on a real trainer. ERG response to the new targets has only been checked in unit tests and by watching the Ride tab without a trainer.
- Related: [ADR 0002](../adr/0002-meter-primary-hybrid-erg.md), [free-ride-activities-allowed](./2026-10-09-free-ride-activities-allowed.md), [session-load-and-adherence](./2026-10-10-session-load-and-adherence.md), [erg-offset-instead-of-ratio](./2026-10-19-erg-offset-instead-of-ratio.md).
