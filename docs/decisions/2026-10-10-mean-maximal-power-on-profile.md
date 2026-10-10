---
date: 2026-10-10
status: active
---

# Mean Maximal Power on Profile (cached, on-demand recompute)

## Context

Riders want Garmin-style lifetime best averages (5s–90min). That conflicts with the earlier choice that session charts are **Power Profile**, not “power curve” / MMP ([power-profile-not-mmp-curve](2026-10-09-power-profile-not-mmp-curve.md)). Recomputing over every **Activity** on each Profile open can get expensive as history grows.

## Decision

- Canonical term: **Mean Maximal Power (MMP)** — distinct from session **Power Profile**. UI may say “Power curve.”
- Durations: 5s, 10s, 30s, 1min, 5min, 10min, 20min, 60min, 90min; all-time across Local Store Activities; trainer watts only.
- Persist `mmp.json` in the **Local Store**; Profile **Recompute** (HTTP `POST /api/mmp/recompute`) refreshes it. Do not auto-recompute on Activity save.
- On read, compare a fingerprint of Activities to the cache and expose `stale` when out of date.
- **Estimated FTP** = 20min MMP × 0.95, compared to set **FTP** (never auto-written).
- MCP: read-only `get_mmp`; no MCP recompute tool. Recompute stays UI/HTTP (does not violate MCP-only FTP/Intent writes).

## Alternatives considered

- **Ephemeral compute on every Profile open** — simpler, but costly as history grows.
- **60min MMP as FTP estimate** — fewer true all-out hours; Coggan 20min×0.95 preferred.
- **Extend `get_rider_profile` with the full curve** — rejected; separate `get_mmp` keeps the profile tool lean.

## Consequences

- Supersedes the “MMP out of scope” clause of [power-profile-not-mmp-curve](2026-10-09-power-profile-not-mmp-curve.md) for the Profile feature; session charts remain **Power Profile**.
- Profile tab gains MMP UI; agents read bests via `get_mmp` when the cache exists.
