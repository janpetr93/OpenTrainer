---
date: 2026-10-10
status: active
---

# Strava upload activity name = `OpenTrainer: <workout>`

## Context

One-click Strava upload was sending the FIT filename (`open-trainer-indoor-<timestamp>`) as the Strava activity title. Riders want titles that identify the workout in Strava’s feed.

## Decision

- Format: `OpenTrainer: <workout name>`.
- Free Ride (`workoutId` null) → `OpenTrainer: Free Ride`.
- Missing/deleted Workout → `OpenTrainer: Workout`.
- Resolve the name in the browser upload helper via `listWorkouts()` (Activity stores only `workoutId`).

## Alternatives considered

- **Keep FIT filename as title** — rejected; opaque in Strava.
- **Store workout name on Activity** — deferred; lookup is enough for v1.
- **Companion derives the name** — deferred; client already owns the `name` field for upload.

## Consequences

- Manual FIT download filename unchanged (`activityFitFilename`).
- Upload requires workouts list at upload time (already available via companion API).
