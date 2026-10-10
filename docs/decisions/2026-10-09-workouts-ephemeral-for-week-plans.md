---
date: 2026-10-09
status: active
---

# Workouts are ephemeral plan structure, not a library

## Context

MCP week planning (“past 2 weeks → plan next week”) is the frequent use case. The domain already treated **Workout** as a reusable template (catalog UI, Ride picker, many **Scheduled Ride**s → one Workout). That framing overstated reuse.

## Decision

Product center is the **Training Calendar** / week plan. A **Workout** is the interval structure behind a **Scheduled Ride** (and ad-hoc Ride start) — fine to create for one week and never reuse. Do not optimize UX or MCP around building a long-lived workout library.

## Alternatives considered

- **A — Ephemeral plan steps (chosen)** — calendar is the product; workouts are structure.
- **B — Growing reusable library** — planning prefers pick/adapt existing workouts.
- **C — Hybrid with promote-to-favorite** — week-scoped by default + escape hatch; deferred unless reuse pain appears.

## Consequences

- Glossary: drop “reusable” as the primary Workout framing (CONTEXT updated).
- **Storage shape:** keep separate **Workout** files + `workoutId` on **Scheduled Ride** / **Activity** (do not embed the plan on the calendar row yet). Existing `create_workout` + `create_scheduled_ride` MCP flow stays.
- **Orphan cleanup:** when scheduled rides are cleared/deleted, delete **Workout**s that have zero remaining **Scheduled Ride**s and zero **Activity**s; keep any workout already referenced by history (`LocalStore.deleteScheduledRide` / `clearScheduledRides`).
- **History tab:** Workouts tab renamed → **History**; **Activity** list (export / Strava / Schedule again). Workout library + sample creators removed from UI.
- **Ride start:** structured rides only via **Scheduled Ride** (Today on Ride / Calendar select). No freestanding workout-catalog picker — unstructured = **Free Ride** (`WorkoutRunner.startFreeRide`).
- **Re-ride:** from a past **Activity** (History or Calendar), **Schedule again for…** creates a new **Scheduled Ride** using that activity’s `workoutId`. Hidden for **Free Ride** activities.
