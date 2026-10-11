---
date: 2026-10-11
status: active
---

# Mean Maximal Power prefers Power Meter watts

## Context

Trainer-primary rides store Assioma as `meterWatts` while primary `watts` stay on the D100. MMP was computing from primary `watts` only (“trainer watts only” in [mean-maximal-power-on-profile](2026-10-10-mean-maximal-power-on-profile.md)), so lifetime bests and Estimated FTP tracked the high trainer scale even when a meter was recorded. Rider wants Assioma-true MMP after seeing ~−21 W average alignment on a long Z2 ride.

## Decision

- **Mean Maximal Power** sample watts = `meterWatts` when present, else primary `watts` (already **Meter Power** in **meter-primary**; **Trainer** when no meter stream).
- Session Load / ERG / FIT primary stream unchanged — only MMP (and thus Estimated FTP from MMP) uses this preference.
- Applies to auto-recompute on Activity save and Profile **Recompute**.

## Alternatives considered

- **Meter-only (skip trainer-only samples)** — cleaner single scale, but empties history without Assioma; rejected.
- **Selectable primary for recording** — already covered by **Power Source Mode** / [ADR 0002](../adr/0002-meter-primary-hybrid-erg.md); MMP preference still needed for past trainer-primary dual-stream Activities.

## Consequences

- Recompute after this change will lower bests that came from trainer-high dual-stream rides.
- Trainer-only Activities still contribute via primary `watts`.
- Updates the watt source in [mean-maximal-power-on-profile](2026-10-10-mean-maximal-power-on-profile.md); durations/cache/Estimated FTP formula unchanged.
