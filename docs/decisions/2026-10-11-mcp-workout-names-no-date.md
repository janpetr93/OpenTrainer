---
date: 2026-10-11
status: active
---

# MCP Workout names omit weekday and date

## Context

Week-planning via MCP was naming Workouts like `Sun Oct 11 — Upper Z2 90 min…`. Those names are reusable templates and also feed Strava titles (`OpenTrainer: <workout>`). Day/date in the name duplicates `Scheduled Ride.startsAt` and ages poorly when a plan is reused or rescheduled.

## Decision

Instruct MCP (`create_workout` tool + `plan_training_week` prompt, and the ChatGPT paste in `docs/mcp-chatgpt-week-planning.md`) to name Workouts by training content only — never a weekday or calendar date.

## Alternatives considered

- **Keep date prefixes for uniqueness** — rejected; calendar already owns timing; content names stay readable in History/Strava.
- **Hard-validate / strip dates in `createWorkout`** — rejected for v1; coaching instruction is enough; enforcement can wait if agents ignore it.

## Consequences

- New plans should look like `Upper Z2 90 min with FTP bursts`, not `Sun Oct 11 — …`.
- Existing dated Workout files are left as-is (no rename backfill).
- Strava titles improve automatically for new rides that use the new names.
