---
date: 2026-11-01
status: active
---

# Hard-work average replaces the adherence downshift

## Context

`plan_training_week` told the model to lower the next hard percent by about 5 when `lastHard.targetAdherence` was under 0.85. **Session Adherence** counts every second outside the band, including spikes above the target. On 19 October the score was 0.754 for the whole hour, while the 3×6 min at 185 W averaged about 203 W. A fixed cut would have made the next workout easier because of overshoot.

Hard days from that planning session also opened with one 10-minute step. Other ERG apps draw a rising warmup and short high-watt efforts. A **Workout** has no ramp step. The week check already allows 15 s at 120% FTP and rejects zone 6–7 and anything at or above 150% FTP.

## Decision

- `lastHard.work` reports `plannedWatts` and `averageWatts` for the main hard efforts (steady steps at or above 88% FTP lasting longer than 45 s, or a short-interval set of at least six steps). Warmup steps are excluded, so 15 s openers do not enter the average. The summary still omits 1 Hz samples.
- When `averageWatts` is at or above `plannedWatts`, the next hard session adds a repeat or minutes at the same percent. When it is lower, the percent stays and no repeat is added. `targetAdherence` no longer changes the percent.
- A hard-day warmup is warmup steps, in order: 5 min at 50% FTP, 5 min at 65%, 3 min at 80%, then 3 × (15 s at 120% FTP, 60 s at 50%). Easy rides stay flat, under 75% FTP, with no bursts. Openers are warmup steps so they do not make the ride a second hard day.
- That recipe is on the MCP server `instructions` field, because the ChatGPT desktop app reads instructions at startup and does not load MCP prompts.

## Alternatives considered

- **Keep the 0.85 rule and ignore seconds above the band** — rejected. The rider did not want a score to force a 5-point cut.
- **A ramp step type** — deferred. Three rising holds ride on the current runner. A continuous ramp is a new step through the chart and both profile builders.
- **Openers at 150% FTP or zone 6–7** — rejected. ERG cannot hold an all-out sprint, and 150% of the set FTP already sits above this rider’s 10-second best.

## Consequences

- A Free Ride that counts as hard has `lastHard.work` null.
- ChatGPT must be restarted before a new chat sees the instructions.
