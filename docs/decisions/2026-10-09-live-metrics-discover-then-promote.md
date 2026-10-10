---
date: 2026-10-09
status: active
---

# Live metrics: discover on D100, then promote

## Context

User wants richer live cycling specs beyond watts, but D100 FTMS field support is unverified.

## Decision

Slice 1 **Live Display** stays watts + connection (+ debug). Debug panel logs all FTMS indoor-bike fields actually notified. Promote to main UI only metrics confirmed on hardware. Target watts / interval time come with the workout runner (slice 3). No separate HR/cadence sensors in v1 unless added later. Never invent missing values.

## Alternatives considered

- **Fixed metric list up front** — risks empty/fake fields if firmware omits them.
- **Require external HR/cadence for v1** — out of agreed personal MVP scope.

## Consequences

- Slice 1 debug output informs the Live Display field set for later slices.
