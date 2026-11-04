# OpenTrainer desktop app

The same OpenTrainer UI and **Local Companion** in one window, for macOS and Windows. No terminal, Node.js, `./start.sh`, AI agent, or MCP needed. Built with Electron.

## Install

Download the latest installer from [Releases](https://github.com/janpetr93/OpenTrainer/releases/latest):

| Computer | File |
| --- | --- |
| Mac with Apple silicon (M1 and later) | `OpenTrainer-<version>-mac-arm64.dmg` |
| Mac with Intel | `OpenTrainer-<version>-mac-x64.dmg` |
| Windows 10 / 11 | `OpenTrainer-<version>-win-x64.exe` |

The builds are not signed with an Apple or Microsoft certificate yet, so the first launch needs one extra step.

### macOS

1. Open the `.dmg` and drag **OpenTrainer** into **Applications**.
2. Open OpenTrainer. macOS says it cannot verify the app. Click **Done**.
3. Open **System Settings → Privacy & Security**, scroll to **Security**, and click **Open Anyway** next to the OpenTrainer message. Confirm with your password or Touch ID.
   On macOS 14 or earlier you can instead Control-click the app in Applications, choose **Open**, then **Open**.
4. The first time you connect a device, macOS asks to let OpenTrainer use Bluetooth. Click **Allow**. If you clicked Don't Allow, turn OpenTrainer on in **System Settings → Privacy & Security → Bluetooth**.

You only do steps 2–4 once.

### Windows

1. Run the `.exe` installer. If SmartScreen shows **Windows protected your PC**, click **More info → Run anyway**.
2. OpenTrainer installs for your user (no admin rights) and adds a Start menu shortcut. Uninstall it from **Settings → Apps**.

### Updating

Download the new installer and install over the old version. Your rides, workouts, and settings stay.

## Using it

- Connect your trainer and sensors on **Devices** or **Ride**, as in the browser. OpenTrainer opens a small window that lists the Bluetooth devices it finds. Click **Connect** next to yours, or **Cancel** (Esc).
- Do not pair the trainer in the system Bluetooth settings first, and quit Zwift or other training apps before connecting.
- On macOS, closing the window keeps OpenTrainer in the Dock. Quit with **⌘Q**. On Windows, closing the window quits.

## Where your data lives

| | macOS | Windows |
| --- | --- | --- |
| **Local Store** (rides, workouts, calendar, profile) | `~/Library/Application Support/OpenTrainer/data` | `%APPDATA%\OpenTrainer\data` |
| Integrations settings | `~/Library/Application Support/OpenTrainer/companion.env` | `%APPDATA%\OpenTrainer\companion.env` |
| Log file | `~/Library/Logs/OpenTrainer/main.log` | `%APPDATA%\OpenTrainer\logs\main.log` |

The first launch creates the Local Store with the two sample workouts. **Show Data Folder** (in the OpenTrainer menu on macOS, the File menu on Windows) opens it. To back up, copy that folder. Uninstalling does not delete it. **Help → Show Logs** shows the log file.

## Strava and Google Calendar (optional)

Both need your own API app, exactly as in the developer setup (see [`companion/README.md`](../companion/README.md)):

- **Strava**: Authorization Callback Domain `localhost`.
- **Google Calendar Mirror**: OAuth client (Web application) with redirect URI `http://127.0.0.1:8787/api/google-calendar/callback`.

Then:

1. Choose **Integrations Settings…** (⌘, on macOS, Ctrl+, on Windows). It opens `companion.env` in your text editor.
2. Paste `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` and/or `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` after the `=` signs and save. This file holds secrets: do not share it.
3. Choose **Restart OpenTrainer**.
4. On the **Profile** tab, click **Connect Strava** or **Connect Google Calendar**. Sign-in opens in your default browser, where your saved logins are. After you approve, the browser tab says to return to OpenTrainer, and the app shows the result on Profile.

The Profile tab mentions `companion/.env`; in the desktop app that file is `companion.env` from step 1.

### Port 8787

The app's local server listens on `127.0.0.1:8787`, because the Strava and Google redirect URIs are registered with that address. If another program holds the port (usually `./start.sh` from a developer checkout), the app says so and offers **Try Again**. Advanced: set `D100_COMPANION_PORT` in `companion.env` to use another port, and register matching redirect URIs.

## AI planning with MCP (optional)

The app never needs MCP. To let ChatGPT, Claude, or Cursor plan training into the desktop app, run the MCP server from a clone of this repo (see the root [README](../README.md#mcp)) and point it at the app's Local Store with `D100_DATA_DIR`.

Claude Desktop (`claude_desktop_config.json`), macOS:

```json
{
  "mcpServers": {
    "open-trainer": {
      "command": "npm",
      "args": ["run", "--silent", "mcp"],
      "cwd": "/ABSOLUTE/PATH/TO/OpenTrainer/companion",
      "env": {
        "D100_DATA_DIR": "/Users/YOU/Library/Application Support/OpenTrainer/data"
      }
    }
  }
}
```

On Windows use `"D100_DATA_DIR": "C:\\Users\\YOU\\AppData\\Roaming\\OpenTrainer\\data"`.

Claude Code, from the repo root:

```bash
claude mcp add open-trainer -e D100_DATA_DIR="$HOME/Library/Application Support/OpenTrainer/data" -- npm run --silent mcp --prefix "$PWD/companion"
```

The app and MCP read and write the same files. Rides MCP schedules show up when you switch tabs or choose **View → Reload**. MCP reads Google credentials from the clone's `companion/.env`, not the app's `companion.env`, so copy the `GOOGLE_*` keys there if MCP should update the Calendar Mirror too.

## Bluetooth notes

- Electron has no built-in Web Bluetooth chooser, so the main process shows its own picker window (`src/bluetooth.ts`). The renderer's connection code is the same as in Chrome and Edge.
- On Windows, a device that asks to confirm pairing or for a PIN gets a prompt. macOS pairs on its own.
- Electron keeps no Web Bluetooth permissions between launches (`navigator.bluetooth.getDevices()` has nothing to return), so after a restart the app opens the chooser again instead of reconnecting silently.

## Development

```bash
npm install --prefix web
npm install --prefix companion
npm install --prefix desktop
npm start --prefix desktop
```

`npm start` builds the web UI, bundles the app into `desktop/dist/`, and launches Electron unpackaged. Unpackaged runs also read the repo's `companion/.env`, and share the installed app's data folder. Useful environment variables:

- `OPENTRAINER_USER_DATA_DIR=/tmp/ot-profile`: throwaway profile folder (data, settings, logs).
- `D100_COMPANION_PORT=8797`: another port, e.g. while `./start.sh` holds 8787.

On macOS, Bluetooth permission belongs to the process that launched the app. Started from a terminal, IDE, or agent shell, the first Bluetooth scan can abort the app with a privacy (TCC) error. To test devices unpackaged, build once and start it through Launch Services instead:

```bash
npm run build --prefix desktop
open -n desktop/node_modules/electron/dist/Electron.app --args "$PWD/desktop"
```

| Command (in `desktop/`) | Result |
| --- | --- |
| `npm test` | Vitest: server, static files, data seeding, chooser state |
| `npm run typecheck` | `tsc` over the desktop and companion sources it imports |
| `npm run pack` | Unpacked app in `release/` (e.g. `release/mac-arm64/OpenTrainer.app`) |
| `npm run dist:mac` | `release/*.dmg` for arm64 and x64 |
| `npm run dist:win` | `release/*.exe` NSIS installer (build on Windows) |

How it fits together:

- `src/main.ts`: Electron main process. Single-instance lock, settings file, first-run seeding, menu, window, navigation guard (other sites and the OAuth sign-in open in the system browser).
- `src/server.ts`: one HTTP server on `127.0.0.1:8787`. `/api/*` goes to the companion's `createRequestHandler` (imported from `companion/src`, bundled by esbuild, so no `tsx` at runtime). Everything else serves `web/dist` with an `index.html` fallback, on the same origin, like the Vite proxy in development. `/desktop/oauth-return` is where the companion sends the browser after sign-in. The app window reloads only when that URL carries a one-time handoff.
- `src/bluetooth.ts`, `src/picker/`: the device picker window and the Windows/Linux pairing handler.
- `scripts/bundle.mjs`: esbuild bundles plus copies of `web/dist` and the sample workouts into `dist/`.
- `electron-builder.yml`: dmg (arm64, x64, ad-hoc signed) and NSIS (x64).

### Releasing

Push a version tag. [`.github/workflows/desktop-release.yml`](../.github/workflows/desktop-release.yml) runs the tests, builds the dmg files on macOS and the installer on Windows, and attaches them to a GitHub Release for that tag. The tag sets the app version.

```bash
git tag v0.1.0
git push origin v0.1.0
```

Tags with a `-` (e.g. `v0.2.0-beta.1`) become pre-releases. **Actions → Desktop release → Run workflow** builds the installers as workflow artifacts without making a release.

To ship signed builds later: give electron-builder an Apple Developer ID (`CSC_LINK` / `CSC_KEY_PASSWORD`, plus notarization credentials) and a Windows code-signing certificate, replace `identity: "-"`, and turn `hardenedRuntime` back on in `electron-builder.yml`.
