---
date: 2026-10-10
status: active
---

# SessionModule watt chart axis ticks

## Context

The shared SessionModule Power Profile (History, Calendar, Ride plan rows) already plotted time on X and watts on Y, but had no scale labels. Riders could not read approximate watt or duration values from the chart alone.

## Decision

- SessionModule enables `showAxes` on `PowerProfileLine`.
- Three light numeric ticks per axis: Y as `N W` (domain min / mid / max), X as `m:ss` (0 / mid / end).
- Session Y domain is data min–max with **10% margin** each side (min 10 W), floor clamped at 0 W — not forced to start at 0.
- Live Ride hero chart stays unlabeled and 0-based (zones + legend already dense).
- Axis labels are **HTML** in a CSS grid around the plot; the SVG plot keeps
  `preserveAspectRatio="none"` and draws faint horizontal gridlines at the Y ticks.

## Alternatives considered

- **Axis titles only (“W” / “time”)** — less useful for reading scale.
- **Axes on the live Ride hero too** — crowded with zone bands and multi-metric legend.
- **SVG text + `meet`** — letterboxed plot; ticks looked detached from the stretched series.
- **SVG text + `none`** — ticks stretched with the plot and misaligned.

## Consequences

- Session charts use `.session-chart-axes` chrome; plot fills the grid cell.
- Tick helpers live in `web/src/chart/axisTicks.ts` for reuse/tests.
