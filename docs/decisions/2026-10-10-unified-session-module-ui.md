---
date: 2026-10-10
status: active
---

# Unified session module UI (Ride / History / Calendar)

## Context

**Scheduled Ride** and **Activity** rows drifted across Ride, History, and Calendar — different shells, chart heights, legends, and whether **Session Purpose** or workout name appeared. Riders should see one module; the only product difference is whether the ride has been done.

## Decision

Use a shared `SessionModule` on Ride, History, and Calendar:

- Same chrome: title | actions, purpose, taller Power Profile chart
- **Title:** Workout name when known; else `Free ride` (Activities) / `Workout` (orphaned scheduled)
- **Scheduled (not ridden):** planned **Power Profile** only (current FTP rebuild + FTP gate from `buildScheduledWorkoutPreview`)
- **Activity (ridden):** achieved **Power Profile**, plus planned overlay and Plan / Achieved legend when a plan exists

Page-specific actions stay as a slot (Select, Start/Remove, Export/Strava/Schedule again).

## Alternatives considered

- **Keep separate `ScheduledWorkoutPreview` vs History row** — already diverging; rejected.
- **One mega-component owning actions** — pages need different buttons; slot is enough.

## Consequences

- History loads Workouts to resolve Activity titles.
- Extends [scheduled ride plan preview](2026-10-10-scheduled-ride-plan-preview.md); preview chrome is now `SessionModule`, not a separate compact component.
- See CONTEXT.md Code map: Session module.
