---
date: 2026-10-11
status: active
---

# Power chart: display-only smoothing for measured watts

## Context

1 Hz trainer/meter power looks spiky on the Ride (and History) Power Profile chart even when the ride feels steady. Riders want a calmer line without changing what is stored or exported.

## Decision

- Smooth **Power** and **Meter** polylines at draw time with a **5 s centered moving average** (`smoothChartPoints`).
- **Display-only** — `PowerSampler` / Activity / FIT stay raw.
- **Plan** stays stepped; HR/cadence strip is unchanged.
- Applies in `PowerProfileLine` for any achieved/meter watts series (Ride + History).

## Alternatives considered

- **Smooth at record time** — would bake into FIT and later analysis; rejected.
- **3 s / 10 s window** — 5 s is a light calm without blurring short intervals much at chart scale.
- **Ride-only** — History would look inconsistent with the live chart.

## Consequences

- Axis domain and zone bands still use raw watts extrema / FTP.
- Instant live watts readout is unaffected (chart only).
