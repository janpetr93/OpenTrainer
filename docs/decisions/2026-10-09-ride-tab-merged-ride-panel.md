---
date: 2026-10-09
status: active
supersedes: 2026-10-09-ride-tab-todays-scheduled-rides.md
---

# Ride tab merges Today + Plan into one Ride panel

## Context

Pre-ride had two stacked panels: **Today** (list + Select) and **Plan** (echo of selection + Start). That duplicated the same choice and left Start awkwardly separated from the schedule.

## Decision

One **Ride** panel on the Ride tab (`LiveDisplay`):

- List today’s **Scheduled Ride**s as selectable rows (Select toggles; Selected again clears)
- No selection → Start is **Free Ride**
- Selection → Start is **Start workout**, plus **Clear · Free Ride instead**
- Calendar handoff that isn’t in today’s list shows as an extra **From Calendar** row
- Start CTA stays in this panel (disabled until trainer connected)

## Alternatives considered

- **Keep Today + Plan** — rejected; redundant echo of the same selection
- **One-tap Start per row** — rejected; keeps connect-then-start and no-auto-start from calendar
- **Title “Today” or “Plan”** — rejected; **Ride** matches the tab and covers Free Ride + schedule

## Consequences

- Supersedes [ride-tab-todays-scheduled-rides](2026-10-09-ride-tab-todays-scheduled-rides.md) layout; same data source (`scheduledRidesForLocalDay`).
- Training-console hierarchy updated in [training-console-ui](2026-10-09-training-console-ui.md).
