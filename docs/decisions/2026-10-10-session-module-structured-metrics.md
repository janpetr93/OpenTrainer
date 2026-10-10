---
date: 2026-10-10
status: active
---

# SessionModule structured metrics

## Context

Activity / Scheduled rows dumped when + duration + power/load into one muted `·`-joined string
(`10/10/2026, 19:34:50 · 0m 39s · avg 0 W · …`). Hard to scan in a data-heavy cockpit.

## Decision

- `SessionModule` takes structured `meta` (`when`, `kind`, `metrics[]`) instead of a secondary string.
- Activities: compact when (`10 Oct · 19:34`), kind tag `vs plan` when a plan exists (title already covers
  Free ride), labeled grid — Duration, Avg, Max, NP, IF, TSS (always shown, zeros kept), plus Done /
  On-target when adherence exists.
- Scheduled: time-only when, Duration (+ Status when outcome), same chrome; Calendar-picked plan uses
  kind `From Calendar`.
- Helpers: `activityMeta` / `scheduledMeta` in `sessionModuleHelpers.ts`.

## Alternatives considered

- **Smarter single line** — still a log string; rejected.
- **Omit zero metrics** — rejected; rider asked to always show the number fields.
- **Activities-only structured layout** — rejected; all SessionModule rows share the meta chrome.

## Consequences

- Extends [unified session module](2026-10-10-unified-session-module-ui.md).
- Old `activitySecondary` / `scheduledSecondary` remain deprecated for any non-UI callers.
- History uses roomier card-separated Session rows and larger metric type; Calendar/Ride share the
  larger SessionModule type scale without History’s card chrome.
