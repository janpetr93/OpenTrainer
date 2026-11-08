---
date: 2026-11-08
status: active
---

# macOS cadence sensor uses CoreBluetooth, not the Web Bluetooth chooser

## Context

The Van Rysel cadence sensor (Decathlon, ANT+ and Bluetooth Smart) never appeared in the cadence chooser. MyWhoosh finds it. Trainer, power meter, and heart-rate strap already connect.

A CoreBluetooth scan of the trainer (`VANRYSEL-HT-fc75`) shows its advertisement carries no service UUIDs. GATT after connect has FTMS and Cycling Power, not CSC (`0x1816`). The separate cadence sensor, when it has been seen at all, advertises with no name and no cadence service UUID. Web Bluetooth's `requestDevice` filter only keeps a peripheral that advertises `0x1816` or whose name starts with Cadence, CSC, Magene, Garmin, Wahoo, or Bryton, so that packet is dropped before the desktop picker ever sees it. The desktop app still used that same Web Bluetooth scan ([desktop app](2026-11-04-desktop-app-electron.md)).

## Decision

On macOS the desktop app scans and connects the **Cadence Sensor** with a CoreBluetooth helper (`desktop/native/cadence-bridge.swift`) spawned by the main process. The picker lists nearby connectable non-Apple peripherals, a farther one whose name looks like a cadence sensor, and anything advertising CSC. The D100 (`VANRYSEL-HT`) is left out: it has no cadence service. Connecting requires the CSC measurement characteristic. A wheel-only notification is reported as speed mode (green light); cadence is the red light.

**Re-pair all** passes the remembered id and exact name. When that sensor is already advertising, the helper connects it without the list. Otherwise the list opens. See [Re-pair all](2026-11-08-repair-all-remembered.md).

Chrome, Edge, and the Windows app keep the Web Bluetooth filter, with a few more brand prefixes. If the helper binary is missing, the Mac app falls back to that filter.

## Alternatives considered

- **Widen the Web Bluetooth name prefixes only** — does not surface a sensor that advertises neither a name nor `0x1816`.
- **Always `acceptAllDevices` for cadence** — still only devices Chromium's chooser is willing to report. That set is what already missed this sensor.
- **Read cadence from the Assioma power measurement** — the rider's missing device is the separate sensor MyWhoosh pairs, not the pedals.

## Consequences

- macOS cadence no longer shares the Web Bluetooth chooser path. Trainer, power meter, and heart rate are unchanged.
- The helper is a separate binary (it cannot live inside `app.asar`). The first scan may need its own Bluetooth allow if macOS does not attribute it to OpenTrainer.
- A remembered cadence id from Chrome will not match the CoreBluetooth id. Re-pair all also matches the remembered name; a normal Connect opens the picker when the id is not advertising.
