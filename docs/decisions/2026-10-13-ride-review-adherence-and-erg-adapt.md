---
date: 2026-10-13
status: active
---

# Ride review fixes: adherence expand + ERG adapt rate/band

## Context

Post-ride review of **Upper-Z2 endurance 45 min** (meter-primary, Assioma + D100) showed: main block tracked target well (~149 W vs 148 W) with a steady ~−20 W Meter−Trainer Δ, but (1) stored **Session Adherence** was 50% while true on-target was ~82%, (2) **ERG Calibration** saved `scale` ~1.05 (wrong direction; true Meter/Trainer ~0.88) because adapt ran every 250 ms tick (~4×/s), and (3) easy warmup (~90 W) never taught the map because the steady band started at meter ≥100 W.

## Decision

1. **Session Adherence** expands sparse planned step-corner profiles to a 1 Hz step-hold series (`expandStepHoldWattSeries`) before scoring against achieved; `flattenWattSeries` remains for dense achieved streams only.
2. **ERG Calibration** EMA adapts **once per elapsed second** (gate in the ride tick), not every 250 ms UI tick. Seeded this bike’s stored scale to the ride’s steady-band median Meter/Trainer (~0.877).
3. Steady adapt band lowered to **meter 70–180 W** so easy warmup samples teach scale.

## Alternatives considered

- **Always recompute adherence on hydrate** — skipped; one-shot Local Store rewrite of planned Activities was enough for existing rows.
- **Integral trim / offset seed instead of scale fix** — trim already raised ([stronger-hybrid-erg-trim](./2026-10-13-stronger-hybrid-erg-trim.md)); open-loop map must be correct or P-only trim leaves steady-state error.
- **Keep 100 W min band** — fails the observed 100 W warmup shortfall learning.

## Consequences

- History / MCP `review_training` see honest adherence for step-corner planned profiles.
- Next meter-primary start open-loop for 148 W ≈ 169 W FTMS (matches observed trainer mean on that ride).
- Related: [ADR 0002](../adr/0002-meter-primary-hybrid-erg.md), [session-load-and-adherence](./2026-10-10-session-load-and-adherence.md).
