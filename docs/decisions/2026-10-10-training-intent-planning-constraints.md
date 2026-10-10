---
date: 2026-10-10
status: active
---

# Training Intent planning constraints

## Context

Week planning re-asked hard-day caps and long-ride preferences every time. **Training Intent** already held goal/horizon/note but not thin structured constraints.

## Decision

Extend **Training Intent** with optional nullable fields:

- `maxHardDaysPerWeek` (0–7)
- `preferredLongRideWeekday` (0=Sunday … 6=Saturday)
- `constraintsNote` (free text)

Still ask weekly availability in chat; do not store a full availability calendar. MCP `set_training_intent` / `get_rider_profile` read+write; Profile tab mirrors read-only. `plan_training_week` must honor constraints when set.

## Alternatives considered

- **constraintsNote only** — softer but less reliable for hard-day caps.
- **Also maxWeeklyHours / restDayWeekday** — deferred until these three prove insufficient.

## Consequences

- Legacy Intent JSON hydrates missing fields as null.
- Sibling to [training-intent-not-chat-only](2026-10-10-training-intent-not-chat-only.md).
