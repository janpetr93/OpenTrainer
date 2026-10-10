---
date: 2026-10-09
status: active
---

# Rider Profile on its own Profile tab

## Context

**Rider Profile** (FTP / Coggan zones) and **Strava Link** lived inside the History tab via `ProfilePanel`, mixed with the **Activity** list. History was crowded; “set FTP on History” copy was misleading.

## Decision

Promote **Rider Profile** + **Strava Link** to a top-level **Profile** tab (same in-app tab pattern as Ride / History / Calendar — no router). History is activities-only. Strava OAuth return (`?strava=…`) opens Profile so the result banner is visible.

## Alternatives considered

- **A — Fourth tab, whole panel (chosen)** — FTP + Strava stay together; page chrome matches other tabs.
- **B — URL route (`/profile`)** — deferred; no deep-link need beyond Strava query.
- **C — FTP only on Profile; Strava elsewhere** — rejected; Strava remains rider settings.

## Consequences

- Nav: Ride · History · Calendar · Profile.
- Copy that pointed at History for FTP now points at Profile.
- `initialAppTab` (`web/src/appTab.ts`) selects Profile when `strava` is in the query string.
