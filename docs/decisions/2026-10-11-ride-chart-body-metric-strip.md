---
date: 2026-10-11
status: active
supersedes: 2026-10-09-ride-chart-multi-metric.md
---

# Ride chart: power hero + body-metric strip

## Context

HR (and cadence) on the shared Ride hero chart used an independent 0→max scale, so typical bpm sat near the top of the tall watts plot and looked disproportionately high next to power/zones.

## Decision

- Keep **plan / power / meter** (+ zone bands) on the main Ride chart.
- Move **heart rate** and **cadence** into a thinner strip under it in the same `ride-chart` container (~75% / ~25% flex split).
- Shared `maxTSec` and playhead across both charts.
- Fixed Y bands: HR **40–200 bpm**, cadence **0–120 rpm** (clamp outside).
- Hide the body strip until HR or cadence has ≥2 samples.

## Alternatives considered

- **Same chart, data-zoomed independent scale** — still fights zone bands visually.
- **Dual Y-axis chrome on one plot** — clutter next to zone labels.
- **0→max on the strip** — simpler, but flatter / less readable than fixed physiological bands.
- **Separate HR and cadence strips** — clearer, more vertical cost mid-ride.

## Consequences

- `ChartScale` is `watts | heartRate | cadence`; `splitRideChartSeries` partitions for the two plots.
- Both plots show HTML axis numbers (power: watts + time; body: HR left / cadence right when both present).
- Updates [ride chart multi-metric](2026-10-09-ride-chart-multi-metric.md) overlay model.
