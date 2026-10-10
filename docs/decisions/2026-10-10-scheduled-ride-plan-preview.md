---
date: 2026-10-10
status: active
---

# Scheduled Ride plan preview (duration + planned Power Profile)

## Context

**Activity** rows on History and the **Training Calendar** already show duration and a **Power Profile** chart. **Scheduled Ride** rows on Calendar day detail and the Ride panel only showed name + start time, so riders could not see the plan they were about to start.

## Decision

Whenever a **Scheduled Ride** appears on Calendar day detail or the Ride panel (today’s list and the “From Calendar” selection), show:

- Planned duration (sum of **Workout** step durations)
- Planned **Power Profile** via `buildScheduledWorkoutPreview` (UI chrome now shared `SessionModule` — see [unified session module](2026-10-10-unified-session-module-ui.md))

Watts are rebuilt from steps + **current FTP** (same as Ride start), not the stored profile snapshot. Compact previews omit Coggan zone bands. If the **Workout** needs FTP (`%FTP` / zone) and FTP is missing, show duration plus a muted “Set FTP…” note instead of a zero-watt chart.

## Alternatives considered

- **Month-grid mini charts** — too cramped for v1; day detail + Ride list are enough.
- **Stored `plannedPowerProfile` only** — drifts if FTP changes after the **Workout** was created.
- **Zero-watt chart when FTP missing** — looks broken; prefer an explicit FTP gate.
- **Zone bands on previews** — keep for live Ride chart; Activity history rows stay line-only.

## Consequences

- Calendar loads **Rider Profile** for FTP when refreshing the month.
- Shared UI keeps Calendar and Ride previews in sync; see CONTEXT.md Code map.
