---
date: 2026-10-09
status: active
---

# Friendlier connectors: Known Devices + Connect All Known

## Context

Ride tab had four dense Connect / Chooser / Scan-all rows. Riders want in-page device lists and a one-tap connect for the usual stack. Web Bluetooth cannot show a live nearby scan in-page — only previously permitted devices via `getDevices()`.

## Decision

- Show **Known Devices** in-page per role (Trainer / Power Meter / Heart Rate / Cadence); tap a name to connect that device.
- **Connect All Known**: explicit button only (no auto-on-load); sequential connect; skip roles with no known device; summarize “connected N of M — … need Find new…”.
- **Disconnect All** beside Connect All Known.
- Per role: Connect / Disconnect primary; **Find New Device** (chooser + scan all) collapsed.
- Connect-all / default Connect picks last-used in session, else first known for that role.

## Alternatives considered

- **Live in-page scan** — rejected; not allowed by Web Bluetooth (Device Picker required).
- **Auto-connect on Ride load** — rejected; flaky without a clear user gesture; can fight other apps.
- **Disable Connect all until all four roles have known devices** — rejected; day-one trainer + meter only is common.
- **Keep all discovery buttons always visible** — rejected; clutter is the complaint.

## Consequences

- Snapshots expose known devices with stable ids (not names only) so the list is actionable.
- First-time pairing still requires **Find New Device** / **Device Picker** once per role.
- Chooser-empty trainer tip moves into the Known Devices / Find new copy rather than a one-off banner.
