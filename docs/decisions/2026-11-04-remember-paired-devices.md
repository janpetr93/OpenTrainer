---
date: 2026-11-04
status: active
---

# Remember the device per role, and Re-pair it in one click

## Context

The rider rides a smart trainer with a **Heart Rate Monitor** in desktop Chrome and has to pick both in the **Device Picker** every time the app opens. MyWhoosh in Chrome does the same. **Known Devices** were supposed to prevent this, but in stock Chrome the list is always empty.

The cause is in Chromium (checked against `main` on 2026-11-04):

- `navigator.bluetooth.getDevices()` and `BluetoothDevice.watchAdvertisements()` are Blink features with status `experimental` (`third_party/blink/renderer/platform/runtime_enabled_features.json5`). Stock Chrome does not expose them. They appear with `chrome://flags/#enable-experimental-web-platform-features`, or with the new permissions backend (`content/child/runtime_features.cc`).
- `kWebBluetoothNewPermissionsBackend` is disabled by default. Its flag, `chrome://flags/#enable-web-bluetooth-new-permissions-backend` ("Use the new permissions backend for Web Bluetooth"), "will enable persistent storage of device permissions" (`chrome/browser/flag_descriptions.h`). Without it, grants live in the in-memory `BluetoothAllowedDevicesMap` and are gone after a browser restart.
- Chrome Platform Status lists getDevices() and forget() with an estimated ship in Chrome 159 ([feature 4797798639730688](https://chromestatus.com/feature/4797798639730688)). Until then a web page cannot keep a Bluetooth permission across restarts unless the rider flips the flag.

Two smaller gaps were in our own code:

- **Known Devices** were filtered by name patterns (D100, Van Rysel, Assioma, Polar…). A trainer with any other name never showed up, even with the flag on.
- After a restart with the flag on, getDevices() can return a device the adapter has not seen yet. `gatt.connect()` then fails until the device advertises once. The spec says to use `watchAdvertisements()` to see when a device is in range before connecting.

## Decision

- **Remembered Device**: after every successful connect, store the device per role (`trainer`, `powerMeter`, `heartRate`, `cadence`) in localStorage under `openTrainer.rememberedDevices.v1` as `{ version: 1, devices: { [role]: { id, name, rememberedAt } } }`. `id` is the origin-scoped `BluetoothDevice.id`. `name` is the advertised name, the key that survives restarts and origin changes. Code: `web/src/ble/rememberedDevices.ts`.
- **localStorage, not the Local Store.** The record belongs with Chrome's per-origin permission: the ids mean nothing outside this origin and browser profile. It has to work when the companion is down, and it is read synchronously at first render. MCP and the companion never need it, so there is no new route or tool. The "localStorage as source of truth" warning in `CONTEXT.md` is about domain records (**Workout**, **Activity**), and this is not one. Clearing site data forgets it, and that also clears Chrome's permission.
- **Known Devices** also include the remembered device, matched by id, then exact name, whatever the name pattern says. Connect picks: explicit id → used earlier this page load → remembered → first known.
- **Reconnect a Known Device**: try `gatt.connect()` first. A trainer still linked from earlier may not advertise at all. If that fails, call `watchAdvertisements()`, wait up to 8 s for one `advertisementreceived`, stop watching, and connect again. If nothing advertises, say "<name> is not advertising — wake it, then Connect again." Code: `web/src/ble/preconnectKnownDevice.ts`.
- **Re-pair**: when a role has no Known Device but a Remembered Device with a name, its Connect button becomes "Re-pair <name>". It opens the Device Picker with `filters: [{ name }]` and the role service in `optionalServices`, so the chooser lists only that device. The service is not in the filter because the D100 often leaves FTMS out of its advertisement ([device discovery](2026-10-09-device-discovery-ftms-uuid.md)). **Find New Device** stays unfiltered for switching devices.
- **Connect All Known** stays an explicit button. It still connects only Known Devices. Its summary names the roles to Re-pair, for example "Re-pair trainer (D100 0421) / heart rate (Polar H10 7A1B)". It does not open choosers itself, because each `requestDevice()` needs its own click.
- **Auto-connect on load stays rejected** ([friendlier connectors](2026-10-09-friendlier-connectors-known-devices.md)). The reason still holds: it can take the trainer from Zwift or MyWhoosh without a click. With the flag on, Connect all known is one click.
- **Persistence hint**: a one-time, dismissible banner on the **Devices** tab. It shows when something is remembered but Chrome returned none of it, either because getDevices() is missing or because it matched no remembered device. It never shows in the desktop app (user agent contains `Electron/`), which has no chrome://flags and keeps no Web Bluetooth permissions between launches. It names the flag, offers to copy its address, and says to relaunch and Re-pair once. Dismissal is stored under `openTrainer.bluetoothPersistenceHintDismissed.v1`. Once Chrome ships persistent permissions, getDevices() will return the remembered devices and the hint will stop appearing on its own.
- The Ride tab shows the remembered name in the sensor pills' tooltip and in "Connect your trainer (<name>) on Devices". It does not get connectors.

## Desktop app (Electron)

The desktop app leaves getDevices() off, because Electron keeps no Web Bluetooth permissions ([desktop app](2026-11-04-desktop-app-electron.md)). Its Known Devices list is always empty, so Connect is always "Re-pair <name>" there. The main-process picker window then lists only the remembered device, and one click connects it. The window loads from the fixed origin `http://127.0.0.1:8787`, so the Remembered Device survives app restarts in Electron's profile.

A shell that answers `select-bluetooth-device` can go further:

- A Re-pair request filters on the exact remembered name, so the device list should hold only that device. Pick it when there is exactly one entry.
- Or read `openTrainer.rememberedDevices.v1` from the renderer's localStorage and match on `name`. The shell's `deviceId` is the platform id, not the Web Bluetooth `BluetoothDevice.id` stored here, so match on the name.
- Connecting with no click at all needs the renderer to tell the shell when a request is a Re-pair. Otherwise, auto-picking the remembered name would also fire on Find new… and block switching devices. That signal needs a preload on the main window, which the desktop app does not have yet. It is left for a follow-up.

## Alternatives considered

- **Companion Local Store** — rejected. It needs the companion running, a new HTTP route, and an async load before the Devices tab can name the device. The stored ids are browser-origin data.
- **Open every chooser from Connect All Known** — rejected. The click's user activation expires within seconds, so a second chooser after a trainer connect would fail.
- **Wait for an advertisement before every Known Device connect** — rejected. It costs up to 8 s when the D100 is linked and silent. Connect first, and watch only on failure.
- **Detect the flag directly** — not possible from a page. getDevices() being present, and what it returns, is the signal.

## Consequences

- Stock Chrome: Devices → Re-pair <trainer> → the chooser lists one device → Pair. Then the same for heart rate. That is two clicks per device instead of finding it in a list, and it is the most a web page can do.
- With the flag on: Re-pair each device once, then Connect all known after every restart.
- Real pairing, restart, and the advertisement wait cannot be tested by an agent. They need a rider with hardware.
