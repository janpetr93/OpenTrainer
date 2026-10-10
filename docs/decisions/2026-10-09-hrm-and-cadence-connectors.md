---
date: 2026-10-09
status: active
---

# Heart rate and cadence connectors (live-only)

## Context

Rider wants Web Bluetooth connectors for a **Heart Rate Monitor** and a **Cadence Sensor**, alongside trainer + power meter.

## Decision

- Add independent notify links: HR Service `0x180D` and CSC `0x1816`.
- Show live bpm / rpm on the Ride tab (cadence sensor preferred over trainer cadence when fresh).
- Sample optional `hrBpm` / `cadenceRpm` onto each achieved **Power Profile** point (~1 Hz) when fresh; persist in Local Store; MCP `list_activities` returns them; FIT writes those fields when present (`undefined` → FIT invalid, never invent 0).
- Share notify-sensor boilerplate in `web/src/ble/notifySensorConnection.ts`.

## Alternatives considered

- **Separate HR/cadence series arrays** — rejected; one sample object is simpler for MCP/agents and FIT records.
- **Only trainer FTMS cadence/HR** — insufficient when dedicated sensors are present.

## Consequences

- Up to four concurrent browser Bluetooth links (trainer, power meter, HR, cadence).
- Chooser name prefixes are heuristics; **Scan all** remains the escape hatch.
- Older Activities without sensor fields remain valid (optional keys).
