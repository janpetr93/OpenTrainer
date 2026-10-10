---
date: 2026-10-10
status: active
---

# Devices: Trainer primary, sensors compact

## Context

The Devices Connectors panel rendered four equal cards. `Find new…` flexed to fill the row,
leaving a large empty slab beside Connect. The page felt awkward for a data-dense cockpit.

## Decision

- **Trainer** is the primary connector block (Known devices list + Connect / Reconnect / Find new).
- **Power meter / Heart rate / Cadence** sit in one **Sensors** group as compact rows: status +
  device, Connect/Disconnect, Known + Find new as small menus (no stretch).
- Bulk Connect all known / Disconnect all stay in the panel toolbar.
- BLE behavior unchanged — layout/chrome only. Friendlier Known Devices rules still apply
  ([2026-10-09-friendlier-connectors-known-devices](2026-10-09-friendlier-connectors-known-devices.md)).

## Alternatives considered

- **Dense equal role table** — rejected; Trainer is the must-connect device for ERG/rides.
- **2×2 equal cards** — rejected; still overweights sensors.
- **Same controls at equal density** — rejected; sensors don’t need a full Known list always visible.

## Consequences

- `ConnectorRole` gains `variant: 'primary' | 'compact'`.
- Extends [Devices tab](2026-10-10-devices-tab.md) presentation only.
