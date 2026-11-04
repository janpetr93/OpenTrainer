---
date: 2026-11-04
status: active
---

# Strava description groups repeated cycles

## Context

The planned-structure block listed every step in one comma-separated string ([2026-10-31-strava-description-stats-and-structure](./2026-10-31-strava-description-stats-and-structure.md)). A sweet-spot set with openers became a wall of text. Upload only has the Activity’s planned **Power Profile** (resolved watts), so the **Workout Repeat** count from the plan is gone.

## Decision

- One block per line.
- A cycle that repeats at least twice collapses to `3x (15s - 240W, 1m - 100W)`. The recovery stays inside the parentheses.
- When two cycle lengths cover the same steps, use the shorter cycle (`4x (6m - 190W, 3m - 100W)` rather than `2x` of that pair written twice).
- A leftover partial cycle stays on its own lines after the group.
- Steps whose watts change (warm-up, cool-down) stay written out.
- Adjacent holds at the same watts stay one duration. The profile cannot tell two identical steps apart from one longer hold.

Session Load, the blank line before the structure, `Ridden at N% of plan`, and the omission of **Session Purpose** are unchanged.

## Alternatives considered

- **`4x (6m - 190W)` with the recovery left out** — rejected; the spins between work steps disappear.
- **Keep one comma-separated line and only add `Nx`** — rejected; Strava still shows one wrapped paragraph.
- **Read Workout Repeat counts off the Workout** — rejected; the upload path only has the planned **Power Profile**, the same reason the 2026-10-31 decision formats resolved watts.

## Consequences

- A long interval set no longer lists every rep.
- Grouping is inferred from the flat profile, one level only (same limit as **Workout Repeat**).
