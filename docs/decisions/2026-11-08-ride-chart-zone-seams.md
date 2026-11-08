---
date: 2026-11-08
status: active
---

# Ride chart marks zone seams, not hundreds

## Context

With **Power Zone** bands on the Ride chart, the watts axis still labeled round hundreds (100 W, 200 W) and drew a line at each. Those numbers do not sit on a zone edge, so they do not say which band the rider is in.

## Decision

When zone bands are drawn, the watts labels and their horizontal lines are the seams between zones (for FTP 220 W: 121, 165, 198, 231, 264, 330). 0 W and the open top of Z7 stay unlabeled. History charts, which do not draw bands, keep their round ticks.

## Alternatives considered

- **Keep hundreds and add seam labels** — two scales on one axis.
- **Drop the lines as well as the hundreds** — the seam is then only a color change, harder to match to the number.

## Consequences

- Z1–Z7 names stay on the right rail. The left rail is the watt edge of each band.
