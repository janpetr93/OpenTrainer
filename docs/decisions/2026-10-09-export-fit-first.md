---
date: 2026-10-09
status: active
---

# Activity export: FIT first

## Context

Handover allows FIT or TCX for manual Strava upload. Needed a default before slice 4.

## Decision

Primary export is FIT, labeled as an indoor trainer ride. TCX only if FIT encoding proves painful. Never invent HR/cadence in the file.

## Alternatives considered

- **TCX first** — fine for Strava; slightly less preferred as the modern default.
- **Both from day one** — extra surface before one format is proven.

## Consequences

- Slice 4 implements FIT export from stored **Activity** samples.
- Sensor fields appear in FIT only when a supported sensor was connected.
