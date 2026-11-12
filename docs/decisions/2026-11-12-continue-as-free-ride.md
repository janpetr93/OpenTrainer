---
date: 2026-11-12
status: active
---

# Continue as Free Ride

## Context

A rider finishing a **Workout** often wants to keep riding: a few more easy minutes, or a planned session cut short in favour of riding by feel. Before this, the ride saved itself and stopped recording when the plan ended. Riding on meant starting a separate **Free Ride**, which split one session into two **Activity**s and two Strava uploads. There was no way to leave the plan mid-workout without stopping.

## Decision

A **Workout** can **Continue as Free Ride** on the same clock and recording:

- **Button** on the Ride screen, next to Skip interval, while running or paused.
- **Plan end**: when the last step finishes or is skipped, the ride carries on as a Free Ride. A note under the timer says when the Workout ended and that Stop saves it all as one ride. Workouts no longer save on their own; Stop saves.
- **Target**: the **Trainer** keeps the current step's ridden target (with any **Ride Intensity** applied), clamped to the Free Ride range. After the plan ends that is the last step's target. An **Open Step** leaves no target until the first nudge. From then on the keys and buttons set watts (Free Ride steps), not a percentage.
- **The Activity**: one **Activity**, still linked to its **Workout** and **Scheduled Ride**. `freeRideFromSec` marks the switch. The saved planned **Power Profile** ends there, so completion reads 100% even if the rider left early. `targetPowerProfile` is the ridden part of the plan followed by the Free Ride targets. **Session Adherence** scores only the planned seconds; **Session Load** uses the whole ride.
- **Strava**: the description gains a last line, `+ 25 min free ride`. Under a minute adds nothing.

## Alternatives considered

- **Save the Workout, then start a separate Free Ride**: two Activities and two uploads for one session, and a gap in the recording.
- **Keep the full plan and mark the rest as skipped**: completion would drop below 100% for a choice the rider made on purpose, and planning would read the session as cut short.
- **Score the free-ride part against the last target**: the rider is no longer following a plan, so on-target there means nothing.
- **Keep auto-save at plan end, add the button only**: the common case (riding past the end of the plan) would still split the ride.

## Consequences

- A Workout that ends needs a Stop to save. A rider who walks away leaves the ride recording, and with the keep-awake change the computer stays awake until Stop.
- A Scheduled Ride can be completed once, so a test ride per scenario needs its own Scheduled Ride.
- History rows do not show the free-ride minutes yet; only Strava does.
