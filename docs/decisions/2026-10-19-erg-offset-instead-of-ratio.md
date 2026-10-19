---
date: 2026-10-19
status: active
---

# ERG Calibration learns a watt offset, not a ratio

## Context

The 19 Oct 2026 threshold ride (meter-primary, Assioma + D100) held 90 W and 135 W on target and ran every 185 W interval about 20 W high. Meter − Trainer was about −22 W on every block, so the ratio rose with power (about 0.81 at 90 W, 0.90 at 185 W). **ERG Calibration** learned only that ratio, and only while the meter was 70–180 W, then set the trainer to `target / scale`. The percentage uplift matched a flat 22 W gap at easy watts and overshot it on the intervals. Proportional trim cannot remove a constant open-loop miss.

## Decision

Learn `offsetWatts` as the trainer − meter gap and keep `scale` at 1, so the open-loop setpoint is target + offset at every power. Adapt once per elapsed second from settled paired samples in 70–450 W. A second-to-second move bigger than 30 W is ignored. A stored ratio-only map (`scale ≠ 1`, `offsetWatts` 0) converts on the first steady sample.

## Alternatives considered

- **Keep the ratio and only raise the 180 W ceiling** — a single ratio still fits one power and misses the others.
- **Learn scale and offset together** — one paired sample cannot separate them, and a noisy slope estimate undoes the offset.
- **Integral trim only** — already rejected; it hunts, and a wrong map still leaves a steady error under proportional trim.

## Consequences

- The same learned gap applies to a 90 W block and a 185 W interval.
- A trainer whose real error is a percentage, not a flat watt gap, will be right only near the power where the offset was learned.
- Supersedes the scale-EMA / 70–180 W band in [2026-10-13-ride-review-adherence-and-erg-adapt](./2026-10-13-ride-review-adherence-and-erg-adapt.md). Adherence scoring from that decision is unchanged.
