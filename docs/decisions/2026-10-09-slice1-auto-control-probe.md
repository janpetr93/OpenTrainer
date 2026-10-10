---
date: 2026-10-09
status: active
---

# Slice 1: auto FTMS control probe on connect

## Context

Handover requires confirming target-power control on the real D100 before workout UI. Slice 1 has no ERG UI, but a debug panel can still prove control-point behavior.

## Decision

On successful **Connection**, automatically read FTMS feature bits; if a control point exists, Request Control; if target-power appears supported, send one harmless probe (prefer target = current **Live Power**, else a fixed easy wattage such as 100 W) and show the response in the debug panel. No workout/ERG controls in the main UI. Failures are readable debug errors — never imply resistance control when unsupported.

## Alternatives considered

- **Read-only feature flags** — safer, but does not confirm control-point acceptance on firmware.
- **Manual “probe” button only** — fine UX-wise; easy to skip and ship workout UI on false confidence.
- **Full ERG UI in slice 1** — out of agreed first-slice scope.

## Consequences

- First connect may briefly change trainer target resistance if ERG is supported — probe must stay conservative.
- Result of the probe becomes the go/no-go signal for later workout-runner work.
