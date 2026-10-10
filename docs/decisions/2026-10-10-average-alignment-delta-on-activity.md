---
date: 2026-10-10
status: active
---

# Average Alignment Delta on Activity

## Context

Rides already record optional `meterWatts` on achieved **Power Profile** samples (comparison-only). Live **Power Alignment** shows a rolling ~5s Meter − Trainer delta, but History/Calendar Activity rows had no ride-level summary of how the **Trainer** and **Power Meter** agreed.

## Decision

- Persist **Average Alignment Delta** on each **Activity** as `averageAlignmentDeltaWatts`: mean of `(meterWatts − watts)` over samples where `meterWatts` is present; null when none.
- Compute at `saveActivity` (same path as **Session Load** / **Session Adherence**); backfill older Activities that predate the field.
- Show as Session module metric **Δ** (e.g. `+8 W`) after Max; omit the metric when null.
- Sign matches live **Power Alignment** (Meter − Trainer). Still comparison-only — does not change primary power, ERG, or FIT.

## Alternatives considered

- **Difference of ride averages** — mixes trainer-only stretches into the delta.
- **Derive on read only** — no stored field; rejected so list/history stays cheap and MCP JSON carries the summary.
- **Always show `Δ —`** — noise on Activities without a meter.

## Consequences

- Companion startup backfill writes the field onto existing Activity JSON when missing.
- UI label stays the short **Δ** shared with the Ride tab; value formatting reuses `formatAlignmentDelta`.
