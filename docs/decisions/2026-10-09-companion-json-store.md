---
date: 2026-10-09
status: superseded
superseded_by: docs/adr/0001-local-companion-json-store.md
---

# Companion-owned JSON store (web UI + MCP)

> Superseded by [ADR 0001](../adr/0001-local-companion-json-store.md).

## Context

Slice 2 pulls MCP early. Browser `localStorage` / IndexedDB cannot be the source of truth for MCP tools. Need a shared local persistence shape before implementing slice 2.

## Decision

A small Node **local companion** owns versioned JSON files under a data directory (`workouts/`, `activities/`). It serves the web app, exposes MCP stdio (`create_workout`, `list_activities`), and a tiny local HTTP API for the React app. Web Bluetooth **Connection** remains in the browser. SQLite deferred unless JSON becomes awkward.

## Alternatives considered

- **Browser-only storage** — cannot back MCP.
- **SQLite from day one** — stronger querying; heavier for a personal app with simple date-range lists.
- **Two stores synced** — drift risk; avoid.

## Consequences

- Slice 1 can still be browser-only; companion arrives in slice 2.
- Single source of truth for **Workout** and **Activity** (and later **Scheduled Ride**).
- Candidate for an ADR (hard to reverse, surprising vs handover “browser-only”, real trade-off).
