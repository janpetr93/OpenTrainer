---
date: 2026-10-09
status: active
---

# First slice: Connection + Live Power only

## Context

Handover MVP includes workout runner, export, persistence, plus user interest in calendar, MCP session creation, and richer cycling metrics. We needed a hard first-cut line before architecture or UI work.

## Decision

Slice 1 proves only that we can establish a **Connection** to the **Trainer** and show **Live Power** on the **Live Display**. Also dump FTMS feature flags / control-point support in a debug view so later ERG work is informed — without building the workout UI.

Deferred until after that proof: workout editor/runner, FIT/TCX export, calendar, MCP, richer metrics beyond watts.

## Alternatives considered

- **Full handover MVP in one slice** — too much UI before we know Web Bluetooth + D100 behavior on the actual laptop.
- **Include calendar or MCP in slice 1** — forces local-server architecture before the Bluetooth risk is retired.
- **FTMS discovery only, no Live Display** — weaker acceptance; rider-visible watts is the real "it works" signal.

## Consequences

- Architecture for slice 1 can stay a tiny localhost Web Bluetooth page.
- Calendar / MCP / persistence shape stays open until Connection + Live Power is confirmed on hardware.
