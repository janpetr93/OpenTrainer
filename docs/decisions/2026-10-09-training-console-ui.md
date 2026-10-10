---
date: 2026-10-09
status: active
---

# Training-console UI overhaul

## Context

The web UI needed a more professional look. Ride was a long stack of equally weighted panels (header lines, metrics, today/plan, connectors, actions), which fought the “live console” job while riding.

## Decision

- **Depth:** Visual polish plus Ride hierarchy — not a full app-shell rewrite; no BLE/workout logic changes.
- **Look:** Training console — dark stage, IBM Plex Sans + Mono, teal/cyan `--accent` / `--metric` for live watts and primary CTAs; green reserved for ok/connected.
- **Ride modes (soft):** Pre-ride shows one **Ride** panel (today’s Scheduled Rides + Start; Free Ride when none selected) → full connectors. While running/paused, chart + metrics + controls dominate; connectors collapse into an expandable status strip. Completed/stopped return to setup so Start is available again.
- **Secondary tabs:** Same tokens and control chrome; no History/Calendar/Profile IA changes.

## Alternatives considered

- **Visual polish only** — rejected; equal-weight panels would still feel like a dashboard while riding.
- **Full shell rethink** — rejected as out of scope for this pass.
- **Evolve forest-green accent** — rejected in favor of a cooler live-metric accent with green kept for connection health.
- **Hard riding mode** (fixed control bar, hide connectors entirely) — rejected; soft strip keeps reconnect reachable mid-ride.

## Consequences

- Ride presentation is mode-dependent (`live-display-riding` / expandable `connectors-strip`).
- Light mode remains secondary via `prefers-color-scheme`.
- Reversible visual choice — no ADR.
