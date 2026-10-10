---
date: 2026-10-09
status: superseded
---

# MCP v1: list Activities + create Workout

> Superseded by [2026-10-09-mcp-v2-week-planning.md](./2026-10-09-mcp-v2-week-planning.md).

## Context

User MCP use cases: (1) show activities from the past N weeks including specs, (2) create a workout with specs. A third bullet was left blank; we closed the surface rather than invent tools.

## Decision

MCP v1 tools:

- `list_activities` (time range → **Activity** summaries including specs)
- `create_workout` (specs → saved **Workout**)

Out of MCP v1: trainer connect/control, start/pause live ride, invent **Activity** samples, Strava upload, `schedule_ride` (calendar scheduling stays UI-only until needed).

Implies **Activity** records are persisted locally after rides (not export-and-forget) so history queries work.

## Alternatives considered

- **Also schedule via MCP** — useful later; not in stated use cases.
- **MCP controls the Trainer** — conflicts with browser Web Bluetooth ownership and slice-1 architecture.

## Consequences

- Later local companion/persistence must share **Workout** and **Activity** stores with the web app.
- “Specs” for both entities still need enumeration before implementation.
