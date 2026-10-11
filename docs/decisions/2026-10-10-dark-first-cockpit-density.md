---
date: 2026-10-10
status: superseded
---

> Superseded by [2026-10-11-light-high-contrast-cockpit](2026-10-11-light-high-contrast-cockpit.md) (light-only paper climate; density/type split lessons still useful historically).

# Dark-first cockpit density restyle

## Context

OpenTrainer’s UI still read as a soft consumer app (teal glow, pill sensor chips, roomy cards) despite an earlier training-console pass. The product is data-heavy; the redesign needed a quieter professional instrument look without changing tabs or features.

## Decision

- **Scope:** Visual system + density only — same tab set and behavior; no Ride IA regrouping.
- **Climate:** Dark-only charcoal cockpit (`color-scheme: dark`). Does not flip to light with system preference — indoor rides need a consistent dark stage.
- **Focus:** Live watts on Ride are the single visual hero; sensors/FTP/actions stay quiet chrome.
- **Type:** Source Sans 3 (UI) + Source Code Pro (metrics/tables).
- **Palette:** Steel cyan accent (`#6A9FB5`) and brighter metric (`#8FCBE0`) for watts; smaller radii; underline-style tabs; flat sensor chips instead of rounded pills.

Ride mode hierarchy from [2026-10-09-training-console-ui](2026-10-09-training-console-ui.md) remains in force; this decision revises that entry’s look tokens only.

## Alternatives considered

- **Visual polish only (no density)** — rejected; equal spacing would still feel spacious/consumer.
- **Light-first instrument** — rejected; indoor rides favor dark for large wattage numbers.
- **Dark-first with system light sibling** — tried first; OS light preference hid the primary design. Locked to dark-only.
- **Equal polish on every tab** — rejected; spend boldness on Ride metrics.
- **Keep IBM Plex** — rejected in favor of a clearer UI/data type split with Source Sans 3 / Source Code Pro.
- **Light IA moves on Ride** — deferred; density without regrouping was enough for this pass.

## Consequences

- Tokens live in `web/src/index.css`; density and Ride chrome in `web/src/App.css`; fonts in `web/index.html`.
- Earlier teal/IBM Plex console look is obsolete; no ADR (reversible visual choice).
