---
date: 2026-10-10
status: active
---

# Auto-recompute MMP when an Activity is saved

## Context

**Mean Maximal Power** could go stale after every ride until the rider hit Profile → Recompute, so **Estimated FTP** / `get_mmp` misled week planning.

## Decision

Call `recomputeMmp()` inside `LocalStore.saveActivity` after the Activity JSON is written. Keep the Profile manual Recompute as an explicit override.

## Alternatives considered

- **Lazy recompute on `get_mmp` when stale** — works but delays cost to MCP/UI reads; save-time keeps reads cheap.
- **Background job** — overkill for a local JSON store.

## Consequences

- Fresh rides almost never leave MMP stale.
- Save path is slightly heavier (full Activity scan); acceptable at current ride counts.
