---
date: 2026-10-13
status: superseded
---

# Strava upload description = Session Purpose + Session Load

> Superseded by [2026-10-31-strava-description-stats-and-structure](./2026-10-31-strava-description-stats-and-structure.md). Session Purpose is no longer sent to Strava.

## Context

One-click Strava upload already sets the activity **name** to `OpenTrainer: <workout>` ([2026-10-10-strava-activity-name-prefix](./2026-10-10-strava-activity-name-prefix.md)). The Strava upload API also accepts a **description**; we were sending none. Riders want useful text in Strava without stuffing metrics into the title.

## Decision

- Build description in the browser upload helper (`stravaActivityDescription`).
- Include **Session Purpose** when present (trimmed).
- When **Session Load** has any of NP / IF / TSS, append a second block: `NP <n> · IF <x.xx> · TSS <n>` (omit null metrics).
- Join with a blank line when both purpose and load line exist.
- Send no `description` field when both are empty (no “Uploaded from OpenTrainer” footer — the name prefix already brands).

## Alternatives considered

- **Purpose only** — rejected; NP/IF/TSS are already on the Activity and useful in Strava.
- **Put metrics in the name** — rejected; noisy in the feed; name stays workout-scoped.
- **Marketing footer** — rejected; redundant with `OpenTrainer:` title prefix.

## Consequences

- Companion `/api/strava/upload` accepts optional `description` and forwards it to Strava’s upload form.
- Description is derived at upload time from the Activity JSON (no extra store fields).
