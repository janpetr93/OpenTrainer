# Local Companion owns JSON Local Store; Bluetooth stays in the browser

Slice 1 proves Web Bluetooth **Connection** + **Live Power** in Chrome/Edge alone. From slice 2, a Node **Local Companion** owns on-disk JSON (**Local Store**) as the single source of truth for **Workout**s and **Activity**s, serves the web UI over local HTTP, and exposes MCP (`create_workout`, `list_activities`). Browser-only storage cannot back MCP; SQLite is deferred until JSON date-range lists become awkward. The companion never owns the BLE link — FTMS stays in the browser.
