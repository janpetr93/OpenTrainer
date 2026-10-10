---
date: 2026-10-09
status: active
---

# Slice 2 shipped: Local Companion + MCP

## Context

Build order placed MCP in slice 2 after D100 proof. ADR 0001 required a companion-owned JSON store shared by UI and MCP.

## Decision

Implemented `companion/` with:

- JSON **Local Store** under `companion/data/`
- HTTP API on `127.0.0.1:8787`
- MCP tools `create_workout` and `list_activities`
- Web **Workouts** tab + Vite `/api` proxy

Activities remain empty until slice 3 recording.

## Alternatives considered

- Browser-only persistence — rejected by ADR 0001 / MCP requirement.
- SQLite — deferred per ADR.

## Consequences

- Dev workflow needs two processes (companion + Vite) until a unified launcher is added.
- Cursor loads MCP via `.cursor/mcp.json`.
