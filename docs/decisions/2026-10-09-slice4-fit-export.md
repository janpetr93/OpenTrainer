---
date: 2026-10-09
status: active
---

# Slice 4: FIT export + Activity Power Profile UI

## Context

Build order next step after workout runner: export completed Activities for manual Strava upload; show planned vs achieved profiles in history.

## Decision

- Encode indoor-cycling FIT in the browser via `fit-encoder` (`web/src/export/`), power records only — never invent HR/cadence.
- Workouts tab: per-Activity **Export FIT** button + planned/achieved **Power Profile** lines.
- Expand sparse achieved samples to 1 Hz hold-forward for FIT records.

## Alternatives considered

- Server-side FIT in companion — unnecessary; Activity JSON already in the UI.
- TCX — deferred per earlier FIT-first decision.

## Consequences

- Manual FIT download remains the offline / no-subscription path.
- > Strava API upload: see [2026-10-09-strava-link-and-upload.md](./2026-10-09-strava-link-and-upload.md) (supersedes “manual only”).
- Users should spot-check one FIT in Strava after first real ride.
