# OpenTrainer — web

Local Vite + React + TypeScript app that connects to a smart trainer (e.g. Decathlon / Van Rysel D100) over **Web Bluetooth FTMS**, shows **Live Power**, and runs a **Control Probe**.

## Requirements

- Desktop **Chrome** or **Edge** (not Safari for v1)
- Open over **localhost** (secure context)
- Do **not** pair the trainer in OS Bluetooth settings first — connect from the app
- Disconnect Zwift / other training apps before connecting

## Run

Start the Local Companion first (API on `:8787`), then:

```bash
cd web
npm install
npm run dev
```

Open the printed `http://localhost:5173` URL in Chrome/Edge.

- **Ride** — Live Power, ride plan / Start, sensor status (link to Devices)
- **Devices** — Connect trainer / sensors, Known Devices, FTMS debug
- **History / Calendar / Profile** — activities, schedule, FTP / Strava

## Test

```bash
npm test
```

## Slice 1 scope

- Connection / reconnect / disconnect
- Live Power with stale/missing states (~2s)
- Collapsible FTMS debug (services, characteristics, features, Control Probe log)

Later slices: Local Companion + MCP, workout runner, FIT export, Training Calendar — see repo `CONTEXT.md` and `docs/`.
