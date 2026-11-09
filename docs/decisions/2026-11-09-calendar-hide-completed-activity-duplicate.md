---
date: 2026-11-09
status: active
---

# Calendar day hides an Activity already shown as a completed Scheduled Ride

## Context

On the [Training Calendar](../../CONTEXT.md), a finished **Scheduled Ride** stays on the day with status `completed`, and the **Activity** it recorded (`activityId`) was listed again under Activities. Same session, twice. The Activity row is the one with actual power, export, and Strava; the Scheduled row is the plan plus status.

## Decision

On a calendar day, omit an **Activity** from Activities when a **Scheduled Ride** on that same day is `completed` and its `activityId` is that Activity. Free rides, and Activities not linked from a completed Scheduled Ride, stay. History is unchanged.

The empty Activities line says the ride is already shown above, so it does not read as “nothing was completed.”

## Alternatives considered

- **Drop the completed Scheduled Ride and keep the Activity** — keeps actual power, export, and Strava on the day, but the user asked to remove the Activities duplicate.
- **New Completed section** — the completed Scheduled Ride already appears on the day; a third heading would not remove the duplicate.

## Consequences

- A day whose only ride was a completed Scheduled Ride shows that ride under Scheduled and an empty Activities note.
- Export, Strava, and Schedule again for that Activity stay on History.
- The month-grid activity dot follows the same filter, so a linked Activity does not add a second mark.
