---
date: 2026-10-09
status: superseded
---

> Superseded by [2026-10-11-meter-primary-hybrid-erg.md](./2026-10-11-meter-primary-hybrid-erg.md) for primary-power / ERG semantics. CPS **Power Meter Connection**, live **Power Alignment**, and Meter − Trainer Δ still apply; trainer-only comparison-only is no longer the end state when a meter is connected at Start.

# Power Meter comparison-only (Assioma Uno)

## Context

Rider has a Favero Assioma Uno pedal **Power Meter** and wants to see how it aligns with **Trainer** watts. App already has one FTMS **Connection**; workout/ERG/recording use trainer power.

## Decision

- Add an independent **Power Meter Connection** over BLE **CPS** (`0x1818`), filtered for Assioma/Favero name prefixes.
- **Power Alignment** is live-only: show **Meter Power** + Δ (Meter − Trainer) on the Ride tab.
- Δ is a rolling **~5s average** of instantaneous deltas (not the raw sample-to-sample jump).
- **Trainer** remains primary for **Live Power**, ERG, and achieved **Power Profile** / FIT.
- Do not sample Meter Power into **Activity** in this slice.

## Alternatives considered

- **Selectable primary power source** — deferred; changes workout/recording semantics.
- **Record dual streams in Activity/FIT** — deferred; live compare is enough to check alignment first.

## Consequences

- Two Web Bluetooth links can be open at once (trainer + meter).
- Uno is single-sided estimated total — Δ reflects that estimate vs trainer, not true L/R dual-sided power.
- UI must label trainer vs meter clearly so Connect buttons are not ambiguous.
