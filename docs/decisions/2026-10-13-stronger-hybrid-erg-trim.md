---
date: 2026-10-13
status: active
---

# Stronger hybrid ERG trim (meter-primary)

## Context

Meter-primary hybrid ERG ([ADR 0002](../adr/0002-meter-primary-hybrid-erg.md) / [2026-10-11-meter-primary-hybrid-erg](./2026-10-11-meter-primary-hybrid-erg.md)) maps Assioma target → FTMS setpoint via **ERG Calibration**, then lightly trims from meter error. With cold-start identity calibration (`scale` 1 / `offset` 0) and the original trim (`gain` 0.35, `max` ±10 W), a persistent ~15–20 W D100-high bias left **Meter Power** ~20 W below the on-screen target — rider expectation was that Assioma should track target.

## Decision

Keep hybrid ERG (open-loop map + closed-loop trim). Raise default trim to **gain 0.7** and **max ±25 W** so a ~20 W Assioma shortfall under identity calibration is closed aggressively without switching to full closed-loop-only control. **ERG Calibration** persistence path unchanged (still save on meter-primary Activity stop).

## Alternatives considered

- **Closed-loop ERG only** — rejected again; more hunting risk, ADR already preferred hybrid.
- **Seed a fixed ~20 W offset** — papers over one trainer; scale/EMA still preferred for warm-up drift.
- **Leave trim at 0.35 / ±10** — fails the observed ride.

## Consequences

- FTMS setpoints can move further from open-loop when Assioma is off target (still capped at ±25 W).
- Cold-start rides should feel closer to target immediately; adapted scale still reduces how often trim saturates.
