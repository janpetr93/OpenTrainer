---
date: 2026-10-09
status: active
---

> “External calendar sync — out of scope” is narrowed by [2026-10-19-google-calendar-one-way-mirror](2026-10-19-google-calendar-one-way-mirror.md).


# Slice 5: Training Calendar shipped

## Context

Agreed calendar: app-local view of future **Scheduled Ride**s and past **Activity**s; MCP does not schedule in v1.

## Decision

- Persist **Scheduled Ride** JSON under `companion/data/scheduled/`
- HTTP: `GET/POST /api/scheduled-rides`, `DELETE /api/scheduled-rides/:id`
- Calendar tab: month grid, schedule form, day detail (start workout → Ride tab; past Activity + FIT export)

## Alternatives considered

- External calendar sync — out of scope
- Auto-start workout from calendar — too aggressive; select + switch to Ride instead

## Consequences

- Restart companion to pick up new routes
- MCP still cannot schedule (UI-only) until a later tool is added
