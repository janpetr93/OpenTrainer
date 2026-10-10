---
date: 2026-10-10
status: active
---

# Session Purpose on Scheduled Ride (and copied to Activity)

## Context

MCP week planning creates **Scheduled Ride**s with Workout names and intensity, but not why that session exists in the week (“improve endurance”, “raise lactate threshold”). That coaching rationale is distinct from rider-level **Training Intent** on the **Rider Profile**.

## Decision

- Add optional free-text **Session Purpose** (`purpose`) on **Scheduled Ride**, set at create time (MCP `create_scheduled_ride`; HTTP POST).
- Schema allows omit/null; `plan_training_week` instructs the coach to always fill it during week planning.
- On ride complete, copy `purpose` onto the saved **Activity** (null for Free Ride / no purpose).
- **Schedule again** copies the Activity’s purpose onto the new Scheduled Ride.
- No update tool — change purpose by delete + recreate (or clear/replan the week).
- UI: show purpose on Calendar day detail and History list; not month-cell markers.
- Do **not** reuse the name “intent” — that remains **Training Intent** only.

## Alternatives considered

- **On Workout** — purpose is about placing the session in the week, not the interval template.
- **Structured `{ for, building, contributes }`** — overlapping prose; one sentence is enough.
- **Field name `intent`** — collides with **Training Intent**.
- **Required on create** — breaks Schedule again / thin clients; prompt guidance is enough.
- **Update MCP tool** — week planning already clear+rewrite; defer mid-week edits.

## Consequences

- MCP summaries and Calendar/History can show the coaching “why” next to each planned/completed session.
- Old JSON without `purpose` reads as null.
- Restart MCP clients after companion upgrade so `create_scheduled_ride` advertises `purpose`.
