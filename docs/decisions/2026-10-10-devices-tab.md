---
date: 2026-10-10
status: active
---

# Devices tab owns connectors

## Context

Ride’s pre-ride surface was dominated by four-role connectors (**Known Devices**, **Connect All Known**, **Find New Device**) plus FTMS debug, while mid-ride still expanded the same UI inside a Sensors strip. Riders want connect/setup separate from the live ride console.

## Decision

- Add a top-level **Devices** tab (nav order Ride · Devices · History · Calendar · Profile).
- **Devices** owns full connectors + collapsed FTMS debug.
  Layout: Trainer primary + compact Sensors — see [devices trainer primary layout](2026-10-10-devices-trainer-primary-layout.md).
- **Ride** keeps a thin sensor-status strip and tab-switch links (“Manage on Devices” / “Connect trainer on Devices”); no expandable mid-ride connectors.
- BLE connection objects stay in `App` so changing tabs does not disconnect.

## Alternatives considered

- **Ride sub-page** (push/pop from Ride) — rejected; other concerns already use top-level tabs.
- **Keep mid-ride expandable connectors** — rejected; duplicates UI and fights Ride focus; reconnect via Devices while links stay up.
- **Text-only hint with no tab switch** — rejected; Start-blocked riders need a one-tap path to Devices.

## Consequences

- Partially supersedes soft mid-ride `connectors-strip` in [2026-10-09-training-console-ui](2026-10-09-training-console-ui.md).
- Friendlier connectors behavior ([2026-10-09-friendlier-connectors-known-devices](2026-10-09-friendlier-connectors-known-devices.md)) still applies; only the home surface moved.
