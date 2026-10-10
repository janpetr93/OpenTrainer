---
date: 2026-10-09
status: active
---

# Prefer Workout / Scheduled Ride / Activity over “session”

## Context

User wants calendar + MCP “create sessions.” Handover already distinguishes workout templates from recorded rides. “Session” was ambiguous across plan, schedule, and recording.

## Decision

Canonical terms:

- **Workout** — interval plan (structure behind a ride; not framed as a reusable catalog — see [2026-10-09-workouts-ephemeral-for-week-plans.md](./2026-10-09-workouts-ephemeral-for-week-plans.md))
- **Scheduled Ride** — Workout on a calendar date/time
- **Activity** — recorded ride outcome (exportable)

MCP “create session” means create a **Workout** and/or **Scheduled Ride**, not open a **Connection** or fabricate an **Activity**.

## Alternatives considered

- **Keep “Session” as the umbrella term** — stays fuzzy in UI, MCP, and docs.
- **“Session” = live ride in progress** — conflicts with calendar/MCP create language.

## Consequences

- CONTEXT and future MCP tool names should avoid `session` or map it explicitly to one of the three terms.
- Calendar is a view of **Scheduled Ride**s; history/export centers on **Activity**.
