---
date: 2026-10-09
status: superseded
---

# Ride tab shows today's Scheduled Rides

> Superseded by [2026-10-09-ride-tab-merged-ride-panel.md](2026-10-09-ride-tab-merged-ride-panel.md) — Today + Plan merged into one **Ride** panel.

## Context

Riders open the Ride tab to Connect and Start. Scheduled Rides lived only on the Training Calendar, so today's plan was easy to miss when already on Ride.

## Decision

On the Ride tab (`LiveDisplay`), show a **Today** section just above the Workout picker:

- List all **Scheduled Ride**s for the local calendar day, sorted by `startsAt`
- Empty state: “No rides scheduled for today”
- **Select** picks that ride’s Workout into the Ride picker (same handoff as Calendar — Connect + Start stay manual; no auto-start)

Query via existing `GET /api/scheduled-rides?since&until` with local day bounds (`dayRangeIso`).

## Alternatives considered

- **Read-only list** — less useful next to Start controls
- **Only next upcoming ride** — hides other same-day plans
- **Auto-Start on select** — rejected; keeps [slice5 calendar](2026-10-09-slice5-training-calendar.md) no-auto-start rule
- **Above live power** — power stays the visual focus; plan sits next to Workout controls

## Consequences

- Ride and Calendar both surface today's schedule; scheduling still happens on Calendar / MCP
- Completing a ride still does not remove or mark the Scheduled Ride (unchanged)
