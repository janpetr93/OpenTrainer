---
date: 2026-10-09
status: active
---

# Device discovery: FTMS UUID + name prefixes, with accept-all fallback

## Context

Web Bluetooth `requestDevice` filters decide whether the D100 appears in the picker. Many trainers do not advertise FTMS (`0x1826`) in the BLE advertisement — only in GATT after connect — so an FTMS-only filter can yield an empty chooser even when the trainer is on.

## Decision

Primary Connect uses OR filters: FTMS service UUID **or** name prefixes (`D100`, `Van`, `Decathlon`, `FTMS`, `Bike`), with FTMS always in `optionalServices`. Secondary **Scan all devices** uses `acceptAllDevices: true` + FTMS `optionalServices`. After connect, show the advertised name on the **Live Display**.

## Alternatives considered

- **FTMS UUID only** — failed in practice when advertisement omits the service.
- **acceptAllDevices only** — works but noisy; keep as explicit fallback.

## Consequences

- Empty chooser → use Scan all devices; still pick the D100 manually.
- Wrong-device risk only on the accept-all path.
