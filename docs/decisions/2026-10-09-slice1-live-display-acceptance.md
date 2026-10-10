---
date: 2026-10-09
status: active
---

# Slice 1 Live Display acceptance

## Context

“Connect + show watts” needs explicit UI states so missing Bluetooth data is not shown as 0 W, and so FTMS capability learning does not wait on the workout UI.

## Decision

Slice 1 **Live Display** includes:

1. **Connection** state: disconnected / connecting / connected / disconnected-with-reconnect
2. Advertised device name when connected
3. **Live Power** as large watts when fresh
4. Stale after ~2s without a power notification; “no power data” if none received yet — never invent 0 W
5. Collapsible debug panel: FTMS services, characteristics, feature flags
6. Connect, disconnect, and reconnect actions on the same screen

## Alternatives considered

- **Watts-only, no stale/debug** — fails acceptance when link drops; delays learning ERG support.
- **Defer debug panel** — weaker match to the handover’s “confirm capabilities on hardware first” task.

## Consequences

- Slice 1 UI is still minimal but not a single number.
- Stale threshold (~2s) can be tuned after seeing real D100 notification rate.
