---
date: 2026-11-04
status: active
---

# Desktop app: Electron shell around the companion and web UI

## Context

Starting OpenTrainer needs Node.js, two `npm install`s, and `./start.sh` (or an agent that runs them). Riders who are not developers cannot do that. The app is already local-first: a Node **Local Companion** on `127.0.0.1:8787` and a Vite web UI that uses Web Bluetooth, which only works in Chromium.

## Decision

Ship a **Desktop App** for macOS and Windows built with Electron, in a new `desktop/` package.

- **One process, one origin.** The Electron main process imports the companion's `createRequestHandler` (bundled by esbuild, so no `tsx` at runtime) and serves `/api/*` plus the built `web/dist` from one HTTP server on `127.0.0.1:8787`. The UI's relative `/api` calls work unchanged, as behind the Vite proxy. The companion code is not modified.
- **Port stays 8787.** Strava and Google redirect URIs are registered against it. If the port is taken (usually `./start.sh`), a dialog explains and offers Try Again. `D100_COMPANION_PORT` is the escape hatch.
- **Local Store in the OS user-data folder**: `<userData>/data`, passed to the companion like `D100_DATA_DIR`. The first run creates it with the two sample workouts; an existing store is never re-seeded.
- **Credentials in a settings file**, `<userData>/companion.env`, same keys as `companion/.env`. The app writes a commented template on first run and opens it from the menu (Integrations Settings…); Restart OpenTrainer applies it. Nothing secret ships in the app or the repo.
- **OAuth in the system browser.** Navigations to `/api/strava/authorize` and `/api/google-calendar/authorize` open the default browser. The companion's return URL points at `/desktop/oauth-return`, which tells the rider to go back. The app window reloads on the Profile result only for a one-time handoff issued after the OAuth state checks out ([oauth return handoff](2026-11-04-oauth-return-handoff.md)).
- **Bluetooth picker in the main process.** `select-bluetooth-device` opens a small picker window (list, Connect, Cancel / Esc); `setBluetoothPairingHandler` covers Windows/Linux confirm and PIN prompts. Renderer connection code (`web/src/ftms`, `web/src/cps`, `web/src/ble`) is untouched.
- **No `experimentalFeatures`.** It would expose `navigator.bluetooth.getDevices()`, but Electron keeps no Web Bluetooth permissions (it always returns `[]`), and the UI calls it on load, which makes macOS ask for Bluetooth before the rider connects anything.
- **MCP stays optional** and separate. Agents run the MCP server from a clone with `D100_DATA_DIR` set to the app's data folder.
- **Installers with electron-builder**: dmg for arm64 and x64 (ad-hoc signed, no hardened runtime) and a per-user NSIS installer for Windows x64. A `v*` tag runs `.github/workflows/desktop-release.yml`, which tests, builds on macOS and Windows runners, and attaches the files to a GitHub Release. Unsigned for now; the README documents Gatekeeper's Open Anyway and SmartScreen's Run anyway.
- `./start.sh` and the browser flow are unchanged.

## Alternatives considered

- **Tauri** — much smaller download, but the UI would run in WKWebView on macOS, which has no Web Bluetooth, and the companion would need a Node sidecar anyway.
- **Companion in a `utilityProcess`** — isolates crashes from the window, at the cost of IPC for the OAuth hand-off and a second bundle. In-process is enough for a single-rider local server; revisit if MMP recompute or the Calendar Mirror ever blocks the UI.
- **Companion serves `web/dist` itself** — would change `companion/src/http/server.ts` and the dev flow; the desktop server wraps the handler instead.
- **Settings screen in the UI for client ids and secrets** — friendlier, but needs new companion routes that write secrets and a live config reload. A settings file keeps the companion contract as it is; a UI can come later.
- **OAuth inside the app window** — Google refuses sign-in from embedded browsers, and the rider's saved logins live in their own browser.
- **Fall back to a random port when 8787 is busy** — the app would run, but Strava and Google sign-in would silently break.
- **Bundle the MCP server inside the app** — would let agents use the app binary as the MCP command, but needs `runAsNode` (disabled by the fuses) or a CLI mode. Deferred.
- **Universal macOS binary** — one download, twice the size; two dmgs keep each one around 120 MB.

## Consequences

- Riders install a download and never see a terminal. Developers keep `./start.sh`; `npm start --prefix desktop` runs the shell unpackaged.
- The app is about 120 MB per dmg (Electron's Chromium). No auto-update yet: riders install a newer release over the old one.
- Electron keeps no Web Bluetooth permissions, so each launch shows the device picker again. Remembering devices for the desktop app needs a main-process approach (e.g. the picker preselecting a remembered device), not `getDevices()`.
- On macOS, launching the app from an agent's or IDE's shell and touching Bluetooth aborts it (TCC blames the parent process). Launched from Finder or the Dock, macOS asks once for Bluetooth.
- Signing and notarization are the next step for a smoother first launch; electron-builder needs the certificates as CI secrets.
- MCP writes Google Calendar changes only with the `GOOGLE_*` keys in the clone's `companion/.env`; the app's `companion.env` is not shared with it.
