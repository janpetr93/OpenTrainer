# OpenTrainer

Local indoor cycling app: connect a smart trainer over **Web Bluetooth FTMS** (built around the Van Rysel / Decathlon D100), run power-target workouts, keep an app-local training history, and plan weeks via **MCP** (Cursor, Claude Desktop, or ChatGPT desktop).

## Requirements

- **Node.js** + npm
- Desktop **Chrome** or **Edge** for the Ride UI (not Safari for v1)
- A Bluetooth FTMS trainer (D100 and similar); optional power meter / HR / cadence sensors
- macOS or Windows (Windows: use Git Bash or WSL for `./start.sh`)

## Quick start

```bash
npm install --prefix web
npm install --prefix companion
./start.sh
```

Starts the Local Companion (`:8787`) and Vite web UI together; Ctrl+C stops both.

Open the Vite URL in **Chrome or Edge**. **Ride** = trainer connect / live metrics. **Workouts** = Local Store via the companion.

Or run separately: `npm run dev:companion` and `npm run dev:web`.

### Web Bluetooth tips

- Use **localhost** (secure context)
- Do **not** pair the trainer in OS Bluetooth first — connect from the app
- Disconnect Zwift / other training apps before connecting

## MCP

MCP talks to the same JSON **Local Store** as the UI. It does **not** need the HTTP companion or Bluetooth.

```bash
npm run mcp
```

| Client | Works with this repo? | How |
| --- | --- | --- |
| **Cursor** | Yes | Project or user MCP config (stdio) |
| **Claude Desktop** | Yes | `claude_desktop_config.json` (stdio) |
| **ChatGPT desktop** | Yes | Settings → MCP servers → STDIO — see below |
| **chatgpt.com (browser)** | No (local stdio) | Use ChatGPT desktop instead |
| **Claude.ai** | No (local stdio) | Use Claude Desktop instead |

Tools: `get_rider_profile`, `set_ftp`, `list_workouts`, `create_workout`, `list_activities`, `list_scheduled_rides`, `create_scheduled_ride`, `delete_scheduled_ride`, `clear_scheduled_rides`, plus prompt `plan_training_week`.

The clone ships two sample workouts (`sample-easy-endurance`, `sample-vo2-intervals`). Set FTP in the Profile tab (or via `set_ftp`) before %FTP / zone targets resolve.

### Cursor

Project config (if you keep `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "open-trainer": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "companion"
    }
  }
}
```

Or absolute paths in Cursor MCP settings:

```json
{
  "mcpServers": {
    "open-trainer": {
      "command": "npx",
      "args": ["tsx", "/ABSOLUTE/PATH/TO/OpenTrainer/companion/src/mcp/server.ts"],
      "cwd": "/ABSOLUTE/PATH/TO/OpenTrainer/companion"
    }
  }
}
```

Enable / trust project MCP, then confirm tools appear. After upgrading companion MCP tools, restart the MCP server so the client is not stale.

### Claude Desktop

Edit the config file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "open-trainer": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/ABSOLUTE/PATH/TO/OpenTrainer/companion"
    }
  }
}
```

On Windows, if `npm` is not found, use `npm.cmd` or the full path to Node/`npx`. Quit and relaunch Claude Desktop after editing. Optional: set `"env": { "D100_DATA_DIR": "/path/to/data" }` to point at another store.

### ChatGPT desktop

Same stdio model as Cursor / Claude Desktop (not chatgpt.com in the browser).

1. `cd companion && npm install`
2. Open **ChatGPT desktop** → **Settings** → **MCP servers** → **Add server** → **STDIO**
3. Name `open-trainer`, command `npm`, args `run` `mcp`, **cwd** = absolute path to `companion/`, e.g. `/Users/you/Projects/OpenTrainer/companion` (macOS/Linux) or `C:\Users\you\Projects\OpenTrainer\companion` (Windows)
4. Save and restart the app; check with `/mcp` in a chat

Full walkthrough + week-plan paste: **[docs/mcp-chatgpt-week-planning.md](docs/mcp-chatgpt-week-planning.md)**.

## Optional: Strava upload

1. Create an API app at [strava.com/settings/api](https://www.strava.com/settings/api) (paid Strava subscription required for Standard Tier apps).
2. Authorization Callback Domain: `localhost`
3. Copy `companion/.env.example` → `companion/.env` and set `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET`
4. Restart companion → Workouts → **Connect Strava**

Manual FIT export works without Strava.

## Packages

| Path | Role |
| --- | --- |
| [`web/`](web/) | Vite + React — Web Bluetooth FTMS UI |
| [`companion/`](companion/) | Local Companion — JSON store, HTTP, MCP |

## Docs

- [`CONTEXT.md`](CONTEXT.md) — domain language
- [`docs/adr/`](docs/adr/) — architecture decisions
- [`docs/decisions/`](docs/decisions/) — session decisions
- [`docs/mcp-chatgpt-week-planning.md`](docs/mcp-chatgpt-week-planning.md) — ChatGPT + tunnel

## License

[MIT](LICENSE) © 2026 Jan Petr

## Tests

```bash
npm test
```
