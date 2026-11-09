---
date: 2026-11-09
status: active
---

# Ride chart fills leftover viewport height

## Context

While a Workout is running, the chart stack was `clamp(22rem, 56vh, 40rem)`. On a tall window that cap left a large empty band under Pause / Skip / Stop. The rest of the Ride chrome (tab bar, readout, intensity, controls) sits outside that height, so a `vh` slice never meets the bottom of the window.

## Decision

The in-ride page is a `100dvh` column. The chart stack is the flexible row: it keeps a `22rem` floor and grows into whatever height remains above the readout and controls. A short window scrolls instead of clipping Pause / Stop.

## Alternatives considered

- **Raise the `40rem` cap** — still a fixed slice of the viewport, so the band under the controls comes back on a taller screen.
- **Keep the cap and center the panel** — the empty area moves, it does not go away. The chart is what should use that space.

## Consequences

- Idle Ride, History, and Calendar charts keep their own heights. Only `.app-riding` grows.
- [DESIGN.md](../../DESIGN.md) layout note matches this (no `40rem` chart cap while riding).
