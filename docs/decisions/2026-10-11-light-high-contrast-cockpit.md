---
date: 2026-10-11
status: active
supersedes: 2026-10-10-dark-first-cockpit-density.md
---

# Light high-contrast cockpit

## Context

The dark-only charcoal cockpit ([2026-10-10-dark-first-cockpit-density](2026-10-10-dark-first-cockpit-density.md)) was hard to read from the bike under room light: soft steel-cyan accents and muted secondary text washed out at distance. Glanceability for live watts matters more than a dim “instrument theater” stage.

## Decision

- **Climate:** Light-only paper instrument (`color-scheme: light`). Does not follow OS dark preference — one consistent high-contrast stage for indoor rides.
- **Scope:** Whole app (Ride, Calendar, History, Profile, Devices) — same tokens everywhere; no dual theme.
- **Palette:** Near-white ground (`#F4F6F8`), white panels, near-black text (`#121417`), darker muted (`#3D4853`), stronger borders (`#9AA8B5`), cobalt accent (`#1B4FD8`) / metric (`#153DB8`). Green/amber/red remain status-only.
- **Type weight:** Keep Source Sans 3 / Source Code Pro; bump mono metric weights (live watts, session numbers, secondary metrics) for distance reading — layout sizes unchanged.
- **Density / Ride hierarchy:** Unchanged from prior console decisions.

## Alternatives considered

- **Keep dark, only raise contrast** — rejected; still weaker under bright room light than ink-on-paper.
- **Harsh pure white / pure black** — rejected as stark for Calendar/History; paper off-white is enough pop without glare.
- **Warm cream studio** — rejected; softer at distance and closer to a generic light-UI default.
- **Deep teal or signal-orange accent** — rejected; cobalt contrasts best on paper without colliding with warn/ok.
- **Enlarge Ride hero watts** — deferred; bolder weights first; enlarge later if still soft from the bike.
- **Light default + dark sibling / follow system** — rejected; dual climate hid the primary design once already.

## Consequences

- Tokens in `web/src/index.css`; metric weight tweaks and zone-band opacity in `web/src/App.css`; font weights in `web/index.html`.
- Supersedes dark-only climate in [2026-10-10-dark-first-cockpit-density](2026-10-10-dark-first-cockpit-density.md); Ride IA from [2026-10-09-training-console-ui](2026-10-09-training-console-ui.md) still applies.
- No ADR — reversible visual choice.
