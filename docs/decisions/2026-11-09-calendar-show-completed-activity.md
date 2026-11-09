---
date: 2026-11-09
status: active
supersedes: 2026-11-09-calendar-hide-completed-activity-duplicate.md
---

# Calendar day shows the completed Activity, not the prescription

## Context

On the [Training Calendar](../../CONTEXT.md), a finished **Scheduled Ride** and the **Activity** it recorded (`activityId`) were the same session listed twice. The first pass hid the Activity and left the prescribed Scheduled Ride (plan, no ridden stats). That is the card without completion data.

## Decision

On a calendar day, omit a **Scheduled Ride** from Scheduled when it is `completed` and its **Activity** is on that day. The Activity stays, with power, load, export, and Strava. Planned and skipped rides stay. A completed ride whose Activity is not on the day stays, so the day is not left blank.

History is unchanged. The month-grid scheduled dot follows the same filter; the activity dot stays on any day with an Activity.

## Alternatives considered

- **Hide the Activity and keep the completed Scheduled Ride** — shipped first, then reversed: the Scheduled row is the prescription, not the ridden session.
- **New Completed section** — Activities already shows the ridden session.

## Consequences

- A day whose only session was a completed Scheduled Ride shows that session under Activities.
- Export, Strava, and Schedule again stay on the calendar day, on the Activity.
