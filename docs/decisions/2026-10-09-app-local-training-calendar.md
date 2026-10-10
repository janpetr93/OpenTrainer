---
date: 2026-10-09
status: active
---

# App-local calendar: Scheduled Rides + Activities

## Context

User wants a calendar; MCP v1 does not schedule. Need a clear UI meaning before later slices.

## Decision

One app-local training calendar showing:

- Future: **Scheduled Ride**s (Workout + date/time)
- Past: completed **Activity**s on the day ridden
- Interactions: future → open/start Workout; past → Activity Specs + Power Profile

No Google/Apple Calendar sync in v1.

## Alternatives considered

- **Upcoming-only calendar** — splits history into another surface; less useful for “what did I do this week?”
- **External calendar sync** — out of scope for personal v1.

## Consequences

- Calendar is a view over **Scheduled Ride** + **Activity**, not a separate source of truth.
- Scheduling UX lives in the app until MCP gains `schedule_ride`.
