---
date: 2026-10-09
status: active
---

# Slice 1 stack: Vite + TypeScript + React

## Context

Need a localhost UI for **Connection** + **Live Power**, with calendar and richer display coming later. Vanilla would be thinner for the prototype but invites a rewrite.

## Decision

Use Vite + TypeScript + React. Keep FTMS / Web Bluetooth in a plain TypeScript module (not inside React components) so domain types stay reusable when MCP/calendar arrive.

## Alternatives considered

- **Vanilla TypeScript + Vite** — fastest throwaway prototype; poor fit once calendar / richer **Live Display** land.
- **Other frameworks (Vue/Svelte)** — fine technically; React is enough and common for this repo’s harness expectations.

## Consequences

- Scaffold is slightly heavier than a single HTML file; still appropriate for a multi-slice personal app.
- Bluetooth layer must stay framework-agnostic from the start.
