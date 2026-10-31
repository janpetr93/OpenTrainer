---
date: 2026-10-31
status: active
supersedes: 2026-10-13-strava-upload-description.md
---

# Strava upload description is stats and workout structure

## Context

Strava’s activity description was **Session Purpose** plus NP / IF / TSS. Purpose is coaching rationale for planning (“raise lactate threshold”), and it read oddly as the public ride text. The planned **Power Profile** already has the step watts.

## Decision

`stravaActivityDescription` sends:

- Session Load when present: `NP <n> · IF <x.xx> · TSS <n>` (omit null metrics).
- Planned structure when the planned profile has any non-zero watts: `10m - 100W, 20m - 150W`. Sub-minute steps use seconds (`30s - 240W`).
- A blank line between the two blocks when both exist.
- No **Session Purpose**. No description at all when both blocks are empty. An all-zero planned profile (targets that never resolved) is omitted.

## Alternatives considered

- **Keep purpose above the stats** — rejected; that is the line the rider asked to drop.
- **Structure from Workout steps (%FTP)** — rejected; the planned profile is already resolved watts, which matches the `100W` form, including repeats expanded as they were ridden.

## Consequences

- Free Rides upload stats only.
- A long interval set lists every rep. Strava gets that string as the description; the FIT file is unchanged.
