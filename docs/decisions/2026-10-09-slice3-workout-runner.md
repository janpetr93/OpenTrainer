---
date: 2026-10-09
status: active
---

# Slice 3: Workout runner + Activity recording

## Context

User asked to build the runner without further grilling; details can tighten later.

## Decision

Ship a pragmatic runner on the Ride tab:

- Select a **Workout**, start / pause / resume / skip / stop
- Show target watts, interval remaining, elapsed
- Apply ERG `Set Target Power` only when `ergControlAvailable` (Control Probe succeeded)
- Sample achieved **Power Profile** ~1 Hz; on complete/stop, `POST /api/activities` with planned overlay from the Workout

## Alternatives considered

- Full editor of live intervals — deferred
- Free-ride recording button — deferred (can add later; stop path already saves)

## Consequences

- Companion must be restarted to pick up `POST /api/activities`
- MCP `list_activities` becomes useful after the first finished workout
