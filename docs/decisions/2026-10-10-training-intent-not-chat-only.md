---
date: 2026-10-10
status: active
---

# Training Intent lives in Local Store (not chat-only)

## Context

Week planning via MCP already gives the AI **FTP** / **Power Zones**, **Activity** history, and the **Training Calendar**. Long-term direction (“raise FTP”, “climbing for a gran fondo”) was tempting to leave entirely in ChatGPT/Claude chat memory — but that is per-vendor, per-thread, and invisible to a fresh planning session.

A coach planning next week needs: current fitness, recent work done, durable intent, and this week’s availability. Availability is ephemeral; phase can often be inferred from activities.

## Decision

- Add a thin durable **Training Intent** in the **Local Store** (not chat history as source of truth): **goal** (required when set), optional free-text **horizon** (not a structured date), optional free-text **note** (overrides / caveats).
- Do **not** store training **phase** — the AI derives recent emphasis from **Activity** history unless the rider writes an override in **note**.
- Do **not** store weekly **availability** — the planning agent should **ask** in chat, then write **Scheduled Ride**s.
- Chat still holds negotiation nuance; Intent is the stable brief MCP can `get`/`set` every week.

## Alternatives considered

- **A — Chat-history only** — rejected: not shared across AI tools; not queryable with MCP; drifts/summarizes away.
- **B — Full multi-week periodization calendar** — deferred: overbuilt until Intent + history prove insufficient.
- **C — Stored phase enum** — rejected for v1: usually derivable; Intent **note** covers deliberate pivots (deload, race week).

## Consequences

- Fold **Training Intent** into `profile.json` / **Rider Profile** as nullable `intent: { goal, horizon, note }` (not a sibling Local Store file).
- Implemented: `LocalStore.setTrainingIntent`, MCP `set_training_intent` (clearable), Profile tab read-only mirror, `plan_training_week` prompt asks Intent + availability and infers phase from activities.
- Write path: MCP only for FTP/Intent (HTTP PUTs removed) — see [mcp-writes-rider-profile](2026-10-10-mcp-writes-rider-profile.md).
- Keep **Workout**s ephemeral week structure ([workouts-ephemeral-for-week-plans](2026-10-09-workouts-ephemeral-for-week-plans.md)).
- Restart MCP clients after companion upgrade so they see `set_training_intent` (server `0.3.2+`).
