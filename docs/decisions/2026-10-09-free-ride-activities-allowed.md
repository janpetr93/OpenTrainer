---
date: 2026-10-09
status: active
---

# Free-ride Activities allowed without a Workout

## Context

**Activity Specs** include planned vs achieved **Power Profile**, but riders may record without starting a plan.

## Decision

Free-ride **Activity**s are allowed. They carry achieved **Power Profile** plus summary metrics; planned overlay is omitted (never invented). Planned-vs-achieved only when the **Activity** started from a **Workout** or **Scheduled Ride**.

## Alternatives considered

- **Require a Workout for every Activity** — blocks casual spins and complicates slice-1→recording path.
- **Invent a flat planned profile for free rides** — dishonest “achieved vs planned.”

## Consequences

- MCP `list_activities` and UI must treat planned profile as optional.
- Recording pipeline can start without selecting a **Workout**.
