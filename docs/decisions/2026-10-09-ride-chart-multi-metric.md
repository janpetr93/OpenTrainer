---
date: 2026-10-09
status: superseded
---

# Ride chart as multi-metric centerpiece

> Superseded by [ride chart body-metric strip](2026-10-11-ride-chart-body-metric-strip.md).

## Context

During a ride the small power-only chart was easy to miss. Rider wants all live metrics on a larger chart as the Ride-tab focus.

## Decision

- Hero chart on the Ride tab overlays plan, trainer power, meter watts, heart rate, and cadence when each has ≥2 samples.
- **Power-related** series (plan / power / meter) share one watts Y axis; HR and cadence stay independently scaled.
- When **FTP** is set, Coggan **Power Zone** bands (Z1–Z7) paint behind the chart on that watts axis, with Z labels.
- Chart is large (`clamp(14rem, 38vh, 22rem)`); instant watts sit below it during a ride.
- Optional `meterWatts` is recorded on achieved samples for chart + MCP (still comparison-only for control/recording primary).

## Alternatives considered

- **All series on one Y axis** — watts dominate; HR/cadence look flat.
- **Stacked mini-charts** — more accurate scales but not one centerpiece.
- **Zone bands without shared watts scale** — bands would not align with the power line.

## Consequences

- Legend names tones (Plan / Power / Meter / Heart rate / Cadence) plus Zones when FTP is set.
- No FTP → no bands (hint to set FTP); Calendar/Workouts keep compact power-only charts.
