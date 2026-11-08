---
date: 2026-11-08
status: active
---

# Re-pair all remembered devices from one click

## Context

**Connect All Known** only reconnected **Known Devices**. After a restart the list is empty (stock Chrome, and always in the desktop app), so the button answered with a summary and did nothing:

> No known devices to connect — Re-pair trainer (VANRYSEL-HT-fc75), power meter (ASSIOMA43274U), heart rate (HRM Belt 32306) / cadence (7678-1)

The rider then had to press **Re-pair** on each role. [Remember paired devices](2026-11-04-remember-paired-devices.md) left it that way because each `requestDevice()` needs a user gesture, and the click expires within a few seconds, so a second chooser after a trainer connect would be rejected.

## Decision

- **Re-pair all** is the same button when every pending role has a **Remembered Device** and no **Known Device**. One click re-pairs those roles, then connects any **Known Devices**. Repairs go first, while the click can still open a chooser.
- The desktop shell is told the remembered name with a synchronous IPC (`bluetooth:arm-repair`) immediately before `requestDevice()`. While that name is armed, `select-bluetooth-device` selects the single matching device and does not open the picker. **Find new** stays unarmed, so it still shows the list. If the name is not seen within 8 s, the picker opens and auto-pick stops.
- `requestDevice()` checks the user gesture at the call. In Electron that check does not survive an `await`, which is why the first build rejected every re-pair with "Must be handling a user gesture". The call runs in the click, before any await. Each later device gets a synthetic click on a hidden button; that click's handler arms the shell and calls `requestDevice()` before it awaits.
- On macOS the cadence sensor uses the CoreBluetooth bridge, not `requestDevice()`. **Re-pair all** asks that bridge to connect the remembered id or exact name without the list when the sensor is already advertising. A single **Re-pair** still shows the list when the id is not seen.
- Chrome has no shell. The same click opens the filtered choosers in order. When Chrome rejects the next one (`Must be handling a user gesture`), the run stops and the summary says to click **Re-pair all** again for what is left. A failure that is not that error (one sensor asleep) does not stop the others.
- Auto-connect on load stays rejected.

## Alternatives considered

- **Keep naming them and leave the per-role buttons** — rejected. That is the behavior the rider hit, and it does not connect anything.
- **One chooser that returns every device** — impossible. `requestDevice()` returns one device.
- **Open every Chrome chooser with no further click, including after a slow confirm** — not possible. The gesture check is in Chromium and the chooser click does not refresh it.
- **Refresh the gesture with a key, then await, then call requestDevice** — failed. The check happens at the call, and the await left the click. The synthetic click has to be the turn that calls `requestDevice()`.

## Consequences

- Desktop: one **Re-pair all** connects trainer, power meter, heart rate, and cadence when each is advertising under the remembered name. No picker unless a name never shows up.
- Chrome: one click starts the choosers. A slow first confirm can still force a second click for the rest. The flag in the persistence hint remains the way to make later sessions **Connect all known** with no chooser.
- Real radios, the gesture pulse, and a restart still need a rider. Unit tests cover the sequencing, the name match, and the shell's pick rule.
