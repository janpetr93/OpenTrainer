---
date: 2026-10-09
status: active
---

# Rider Profile: FTP with derived Coggan Power Zones

## Context

ChatGPT week-planning needs FTP and zones so workouts can be prescribed as hard/easy relative to the rider, not only absolute watts.

## Decision

v1 **Rider Profile** stores **FTP** (watts) only. **Power Zones** are the seven Coggan bands computed from FTP. No manual zone % editing yet. Workout steps will support absolute watts and/or `%FTP` / zone targets (resolution timing still open).

## Alternatives considered

- **Custom zone percentages from day one** — more flexible; extra UI/MCP surface before the planning loop works.
- **Zones without FTP** — doesn’t match how ChatGPT/coaching language works.

## Consequences

- Need Local Store + UI + MCP for profile.
- Need zone-aware workout step model before planning quality is good.
