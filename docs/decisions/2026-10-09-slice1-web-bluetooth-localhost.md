---
date: 2026-10-09
status: active
---

# Slice 1 delivery: localhost Web Bluetooth app

## Context

Slice 1 only needs a **Connection** and **Live Power**. Calendar and MCP will likely need a local companion process later, but that must not block proving the D100 link.

## Decision

Ship slice 1 as a plain local web app served in a secure context on localhost, desktop Chrome or Edge only. All Bluetooth work stays in the browser via Web Bluetooth. No Electron/Tauri, no OS Bluetooth pairing, no companion/MCP process in this slice.

## Alternatives considered

- **Electron / Tauri** — heavier; native BLE possible but unnecessary while Web Bluetooth is viable on Chrome/Edge.
- **Local companion server from day 1** — useful later for MCP/shared persistence; adds moving parts before hardware risk is retired.

## Consequences

- Must verify Web Bluetooth on the actual laptop/browser before UI investment beyond the prototype.
- MCP/calendar architecture remains open; may add a local process in a later slice without changing the browser FTMS layer.
