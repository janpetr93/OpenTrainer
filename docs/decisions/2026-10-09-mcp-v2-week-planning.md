---
date: 2026-10-09
status: active
supersedes: docs/decisions/2026-10-09-mcp-v1-activity-list-and-create-workout.md
---

# MCP v2: week planning (profile + calendar + zone workouts)

## Context

User wants ChatGPT to plan the next week from recent activities/schedule plus FTP/zones (e.g. 2 hard, 1 easy). MCP v1 only had `list_activities` + `create_workout` (absolute watts); calendar was UI-only.

## Decision

MCP v2 tools:

- `get_rider_profile` / `set_ftp`
- `list_activities` (existing)
- `list_workouts`
- `create_workout` (extended: watts and/or `%FTP` / zone **Target Prescription**)
- `list_scheduled_rides` / `create_scheduled_ride` / `delete_scheduled_ride`
- `clear_scheduled_rides` (date range — replace a week cleanly)

Still out of MCP: trainer connect/ERG, inventing Activities, Strava upload.

## Alternatives considered

- **Delete rides one-by-one only** — workable; `clear_scheduled_rides` is better for “replace next week.”
- **Keep calendar UI-only** — blocks the ChatGPT planning loop.

## Consequences

- Implement **Rider Profile** Local Store + UI.
- Extend workout step schema; resolve watts at run from FTP.
- Update `.cursor/mcp.json` descriptions as tools land.
