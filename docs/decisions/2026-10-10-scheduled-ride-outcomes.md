---
date: 2026-10-10
status: active
---

# Scheduled Ride outcomes (planned / completed / skipped / missed)

## Context

Week review could not tell “Tuesday was planned but not ridden” from “rest day.” Activities only stored `workoutId`, not which **Scheduled Ride** was completed.

## Decision

- Persist `status: planned | completed | skipped` on **Scheduled Ride**, plus optional `activityId` / `skipReason`.
- Derive **missed** at list time: `status === planned` and `startsAt` in the past (no cron).
- Thread `scheduledRideId` from Ride/Calendar selection into Activity save; mark the ride `completed`.
- MCP: `skip_scheduled_ride`, `reschedule_scheduled_ride` (reschedule clears skip → planned).
- Calendar: Skip affordance + outcome label; no fake Activities for misses.

## Alternatives considered

- **Auto-write missed status on a timer** — rejected; derived view is enough.
- **Delete unridden rides** — loses coaching signal for review.

## Consequences

- `list_scheduled_rides` / UI show status + `missed` for honest replanning.
- Legacy scheduled JSON hydrates to `planned` with null activity/skip fields.
