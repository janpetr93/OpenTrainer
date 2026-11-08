---
date: 2026-11-08
status: active
---

# Zone color off the Ride chart

## Context

Power Zone color lived only on the Ride chart. Profile listed the zones in ink, History stored time in zones without showing it, and the mean-maximal curve was one black line.

## Decision

The same seven hues appear in three other places:

- Profile zone rows use the paper tint and a swatch. That list is the key.
- History and Calendar activities show a bar of time spent in each zone. Scheduled Rides have no ridden zones, so they stay uncolored.
- Mean-maximal points take the zone their watts fall in. The curve stays ink.

History and Calendar charts stay line-only. Devices has no zone data.

## Alternatives considered

- **Zone bands on every session chart** — those previews are small and already omit bands so the line stays readable.
- **Color only the Profile list** — History already has the time-in-zone numbers and was showing none of them.

## Consequences

- Tokens `--zone-1` … `--zone-7` and matching paper tints live on the page, and the Ride chart uses them.
