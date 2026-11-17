---
date: 2026-11-17
status: active
---

# FTP progression: two dated series

## Context

Profile shows one **Estimated FTP** (lifetime 20-minute **MMP** × 0.95) next to one set **FTP**. A date chart needs a value on each date. A single ride’s 20-minute average, or a rolling window, would be a different number from **Estimated FTP**.

## Decision

On a date, **Estimated FTP** is the best 20-minute average in any **Activity** on or before that date, times 0.95. Same windows and watt source as **MMP** (Power Meter watts when recorded). The series holds flat and steps up only when a new 20-minute best is set. It never writes the **Rider Profile**.

## Alternatives considered

- **Each Activity’s own 20-minute best** — moves on easy days and stops matching the lifetime **Estimated FTP** figure.
- **Best inside a rolling window** (for example 90 days) — drops old bests, so the line is no longer **Estimated FTP**.

## Set FTP line

The profile stores only the current watts, so the manual line cannot be read off `profile.json` alone.

- Going forward, each `set_physiology` / `set_ftp` that changes **FTP** (including a clear) appends `{ setAt, ftpWatts }` to **FTP History**. The line holds that value until the next entry. A clear breaks the line.
- Before the log, rebuild steps from Activity `ftpWattsAtSave` in ride order: a new step on the first Activity whose snapshot differs, dated at that Activity. Snapshots are used as stored (a later Session Load backfill can stamp today’s FTP onto an old ride).
- If the current profile watts differ from the last step and were never logged, that step is dated today.

## Alternatives considered (set FTP)

- **Activity snapshots only** — a Monday change stays invisible until Tuesday’s ride, including from now on.
- **Log only, no reconstruction** — the chart has no past until the next `set_ftp`.

## Where it sits

**FTP Progression** is its own read-only block on the Profile tab, under Physiology and above the power curve. The power curve and its one-line Estimated-vs-set comparison stay.

The x-axis is local calendar dates (`localDateKey`), from the first date either series has a value through today. A later **FTP** set on the same local day replaces that day’s step. Lines hold flat between events. **Estimated FTP** is derived from the Activities still in the store, so deleting a ride can lower a past step. Vertices are the change dates, not one point per day.

## MCP

`get_ftp_progression` is read-only and returns the same change-points as the chart. Each point is the reading as of that local date: a repeated wattage means that series is still in force; null means it has no value (not set yet, or **FTP** cleared). Week-planning prompts keep using `get_mmp` for the current comparison.

## Consequences

- See [CONTEXT.md](../../CONTEXT.md) **Estimated FTP**, **FTP History**, **FTP Progression**.
