---
date: 2026-10-10
status: active
---

# Session Load and Session Adherence on Activities

## Context

AI week planning could read **Activity** Power Profiles but lacked coach-grade load and “did the prescription land?” signals. NP/IF/TSS were deferred in the Power Profile decision.

## Decision

- Persist **Session Load** (Coggan NP, IF, TSS, time-in-zone seconds, `ftpWattsAtSave`) and **Session Adherence** (`completionRatio`, `targetAdherence`) on each **Activity** at save.
- Target band: on-target when `|achieved − planned| ≤ max(15% × planned, 20W)`.
- Sparse planned step-corner profiles are expanded to 1 Hz step-hold before scoring (see [2026-10-13-ride-review-adherence-and-erg-adapt](./2026-10-13-ride-review-adherence-and-erg-adapt.md)).
- Free Ride: adherence null; load + zones still computed when FTP is set.
- NP/IF/TSS null when fewer than 30 samples; load null when FTP unset.
- Backfill missing fields on companion/MCP startup and lazy hydrate on list/get.
- UI: light NP/IF/TSS/adherence on Session module secondary line; no CTL/ATL.

## Alternatives considered

- **MCP-only metrics** — rejected: riders should see the same numbers the AI uses.
- **±10% only band** — too tight for ERG wobble; chose looser band.
- **Compute on read only** — rejected: unstable if FTP changes; snapshot at save.

## Consequences

- `list_activities` carries load/adherence for `review_training` / week planning.
- Older Activity JSON gains fields via backfill when FTP is known.
