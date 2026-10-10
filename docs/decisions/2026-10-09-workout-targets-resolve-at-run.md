---
date: 2026-10-09
status: active
---

# Workout targets: keep prescription, resolve watts at run

## Context

With FTP-based planning, targets may be `%FTP` or zone. FTP can change after a plan is written.

## Decision

**Workout** steps store a prescription: absolute `targetWatts` and/or `percentFtp` and/or `zone`. Planned **Power Profile** and ERG **target watts** are computed from the current **Rider Profile** FTP when displaying/starting the ride. Missing FTP blocks zone/%FTP starts with a clear error (absolute-watts-only workouts still run).

## Alternatives considered

- **Resolve only at create** — simple, but stale when FTP updates.
- **Prescription only, no snapshot** — charts need FTP every time; acceptable and chosen for live resolution.

## Consequences

- Step schema and `create_workout` MCP must accept zone/%FTP.
- Runner + Power Profile builders need an FTP resolver.
