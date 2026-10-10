# OpenTrainer — Local Companion

Owns the **Local Store** (JSON on disk), HTTP API for the web UI, and MCP tools.

## Run HTTP API

```bash
cd companion
npm install
npm run dev
```

Listens on `http://127.0.0.1:8787`. Data dir: `companion/data/` (override with `D100_DATA_DIR`).

### Routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness |
| GET | `/api/profile` | **Rider Profile** + Coggan zones (read-only; set FTP/Intent via MCP) |
| GET | `/api/mmp` | Cached **Mean Maximal Power** + Estimated FTP vs set FTP + `stale` |
| POST | `/api/mmp/recompute` | Recompute MMP from all Activities and persist `mmp.json` |
| GET | `/api/workouts` | List **Workout**s |
| POST | `/api/workouts` | Create **Workout** |
| GET | `/api/activities?pastDays=14` | List **Activity**s |
| GET | `/api/scheduled-rides?since=&until=` | List **Scheduled Ride**s |
| POST | `/api/scheduled-rides` | Create **Scheduled Ride** `{ workoutId, startsAt }` |
| POST | `/api/scheduled-rides/clear` | Clear **Scheduled Ride**s in range |
| DELETE | `/api/scheduled-rides/:id` | Remove **Scheduled Ride** |
| GET | `/api/strava/status` | **Strava Link** status (`configured`, `linked`, athlete) |
| GET | `/api/strava/authorize` | Start OAuth (302 → Strava) |
| GET | `/api/strava/callback` | OAuth callback (302 → web UI) |
| POST | `/api/strava/disconnect` | Clear stored Strava tokens |
| POST | `/api/strava/upload` | Upload FIT `{ activityId, fitBase64, force? }` |

## Strava Link

Optional one-click **Activity** upload. Manual **Export FIT** still works without this.

1. Create an API app at [strava.com/settings/api](https://www.strava.com/settings/api) (Strava subscription required).
2. Set Authorization Callback Domain to `localhost` (or `127.0.0.1`).
3. Copy `companion/.env.example` → `companion/.env` and fill `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET`.
4. Restart the companion, open Workouts → **Connect Strava**, then use **Upload to Strava** on an Activity.

OAuth callback URL used by the companion: `http://127.0.0.1:8787/api/strava/callback`.

## MCP

```bash
npm install
npm run --silent mcp
```

Use `--silent` so npm’s lifecycle banner does not mix into MCP stdio. `tsx` is a dev dependency — install before connecting a client.

Server name: `open-trainer`. Tools (v2 week planning):

- `get_rider_profile` / `set_ftp` / `set_training_intent` — **FTP**, Coggan **Power Zones**, **Training Intent**
- `get_mmp` — cached **Mean Maximal Power** + Estimated FTP (read-only; recompute in Profile UI)
- `list_workouts` / `create_workout` — templates; steps use watts and/or `%FTP` / zone
- `list_activities` — past rides + **Power Profile**s
- `list_scheduled_rides` / `create_scheduled_ride` (optional **Session Purpose**) / `delete_scheduled_ride` — **Training Calendar**
- `clear_scheduled_rides` — wipe a date range before writing a new week
- Prompt: `plan_training_week` — suggested tool order

Committed project configs: [`.mcp.json`](../.mcp.json) (Claude Code), [`.cursor/mcp.json`](../.cursor/mcp.json) (Cursor). Root [README.md](../README.md) covers those clients plus **Claude Desktop** and **ChatGPT**. Week-plan paste: [docs/mcp-chatgpt-week-planning.md](../docs/mcp-chatgpt-week-planning.md). Agent cheat sheet: [AGENTS.md](../AGENTS.md).

### Claude Desktop / absolute-path example

```json
{
  "mcpServers": {
    "open-trainer": {
      "command": "npm",
      "args": ["run", "--silent", "mcp"],
      "cwd": "/ABSOLUTE/PATH/TO/OpenTrainer/companion"
    }
  }
}
```

Alternate: `"command": "npx"`, `"args": ["tsx", "src/mcp/server.ts"]`, same `cwd` (no npm banner).

## Test

```bash
npm test
```
