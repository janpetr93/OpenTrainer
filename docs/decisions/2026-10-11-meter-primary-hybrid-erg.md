---
date: 2026-10-11
status: active
supersedes: 2026-10-09-power-meter-comparison-only.md
---

# Meter-primary mode + hybrid ERG (when Power Meter connected)

## Context

Indoor **Trainer** (D100) watts ran ~15–20 W high vs Assioma on a long Z2 ride (warm-up drift). Rider wants indoor numbers to match outdoor Assioma watts, while trainer-only users must keep today’s D100-primary behavior. Prior decision kept the meter comparison-only and deferred selectable primary.

## Decision

- **Power Source Mode** is chosen automatically at **Start**:
  - **Power Meter** connected and fresh → **meter-primary**
  - otherwise → **trainer-primary** (unchanged)
- In **meter-primary**:
  - Workout / FTP targets are **Power Meter** watts.
  - **Live Power** and achieved **Power Profile** `watts` (NP/TSS/MMP/adherence/FIT) use the meter.
  - **Trainer** remains the ERG actuator only; store its stream as `trainerWatts`.
  - **Hybrid ERG**: map meter target → FTMS setpoint via a stored scale/offset, then lightly trim from Assioma error while both streams are fresh.
- If the meter goes stale mid-ride: keep open-loop ERG from the calibration map; do **not** swap primary to trainer for that session; surface stale.
- **ERG Calibration** (scale/offset) lives in a separate Local Store file (not **Rider Profile**); live-adaptive from steady paired samples; persisted at Activity save; cold-start 1.0 / 0 W when missing.
- **Average Alignment Delta** remains Meter − Trainer (physics), regardless of which field is primary.
- Trainer-only riders: no meter required; no hybrid path.

## Alternatives considered

- **Always meter-primary / meter required to Start** — breaks trainer-only users.
- **Closed-loop ERG only** — handles drift but more hunting/risk for v1.
- **Fixed scale only** — simpler; fails the observed warm-up drift.
- **Keep `watts` = trainer; analytics branch on a flag** — dual code paths; easy to get TSS/MMP wrong.
- **Calibration on Rider Profile** — mixes device pairing state with FTP/intent.
- **Fall back to trainer-primary when meter drops** — poisons outdoor-comparable Activity series mid-ride.

## Consequences

- Supersedes “trainer always primary” in `2026-10-09-power-meter-comparison-only.md` (CPS link + Δ comparison remain).
- Recording/FIT schema gains `trainerWatts` (and session `primaryPowerSource`) for meter-primary Activities; older Activities unchanged.
- ERG FTMS setpoint may differ from on-screen target watts in meter-primary — UI should make that clear when useful.
- Promoted to [ADR 0002](../adr/0002-meter-primary-hybrid-erg.md).
