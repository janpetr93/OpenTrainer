---
date: 2026-11-08
status: active
---

# Cadence rpm goes to zero when the crank stops

## Context

The cadence sensor only notifies when the crank count changes. After the rider stops pedaling, the last rpm stayed on the Ride tab. The shared freshness flag did turn the sample stale after two seconds, and the ride log already ignores a stale cadence sample, but the on-screen number kept showing that last rpm.

## Decision

While the **Cadence Sensor** is connected, rpm becomes 0 about two crank strokes after the last movement. That wait is at least 1.2 seconds and at most 3 seconds, using the latest revolution period. A packet that repeats the same crank count does not reset the wait and does not clear rpm by itself.

0 is a real sample (fresh), so the Ride tab shows 0 from the sensor and the activity log records 0. It does not fall back to trainer cadence for that moment.

## Alternatives considered

- **Clear rpm on a repeated crank count** — some sensors repeat the last count between strokes. That would flash 0 while the rider is still pedaling slowly.
- **Reuse the two-second power stale flag as the on-screen value** — the Ride tab was not using that flag for the number, and a hard two seconds flickers at a low cadence.

## Consequences

- Stopping from a fast cadence clears the number in about a second. Stopping from a slow one can take up to three seconds.
- A recorded 0 means the crank was still, not that the sensor was missing. A missing sensor still leaves cadence off the sample.
