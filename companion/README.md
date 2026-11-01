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
| GET | `/api/google-calendar/status` | **Calendar Mirror** status (`configured`, `linked`, `calendarId`, `lastError`) |
| GET | `/api/google-calendar/authorize` | Start Google OAuth (302 → Google) |
| GET | `/api/google-calendar/callback` | OAuth callback (302 → web UI) |
| POST | `/api/google-calendar/disconnect` | Clear stored Google tokens; leave the OpenTrainer calendar in Google |

## Strava Link

Optional one-click **Activity** upload. Manual **Export FIT** still works without this.

1. Create an API app at [strava.com/settings/api](https://www.strava.com/settings/api) (Strava subscription required).
2. Set Authorization Callback Domain to `localhost` (or `127.0.0.1`).
3. Copy `companion/.env.example` → `companion/.env` and fill `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET`.
4. Restart the companion, open Workouts → **Connect Strava**, then use **Upload to Strava** on an Activity.

OAuth callback URL used by the companion: `http://127.0.0.1:8787/api/strava/callback`.

## Calendar Mirror

Optional one-way copy of **Scheduled Ride**s onto a dedicated OpenTrainer calendar in Google Calendar. **Activity**s are not copied. Events stay in Google after the companion stops. Connect and disconnect live on the Profile tab.

1. In Google Cloud Console, create an OAuth client (Web application) with redirect URI `http://127.0.0.1:8787/api/google-calendar/callback`.
2. On the consent screen, add the scope `https://www.googleapis.com/auth/calendar.app.created` and add your Google account as a test user. Testing mode is enough; the app does not need to be published.
3. Copy `companion/.env.example` → `companion/.env` and fill `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
4. Restart the companion, open Profile → **Connect Google Calendar**.

Planned rides from the start of today are copied on connect. Later creates, reschedules, skips, deletes, and clears update Google while the companion or MCP process is running. Starting either one catches up. Disconnect stops updates and leaves the calendar in Google. Reminders are off.

OAuth callback URL: `http://127.0.0.1:8787/api/google-calendar/callback`.

## MCP

```bash
npm install
npm run --silent mcp
```

Use `--silent` so npm’s lifecycle banner does not mix into MCP stdio. `tsx` is a dev dependency — install before connecting a client.

Server name: `open-trainer`. Tools (v2 week planning):

- `get_rider_profile` / `set_ftp` / `set_training_intent` — **FTP**, Coggan **Power Zones**, **Training Intent**
- `get_mmp` — cached **Mean Maximal Power** + Estimated FTP (read-only; recompute in Profile UI)
- `get_training_summary` — planning read of recent rides (load, adherence, kind, compact steps, rollup). `lastHard.work` is the planned watts of the main hard efforts and the average held. No 1 Hz **Power Profile**s
- `check_training_week` — violations against the week-planning rules after the calendar is written
- `list_workouts` / `create_workout` — templates; quality steps use `%FTP` (zone only for Z1–Z2); a **Workout Repeat** plays inner steps `count` times; names are content-only (no weekday/date)
- `list_activities` — past rides + **Power Profile**s
- `list_scheduled_rides` / `create_scheduled_ride` (optional **Session Purpose**) / `delete_scheduled_ride` — **Training Calendar**
- `clear_scheduled_rides` — wipe a date range before writing a new week
- Prompts: `plan_training_week` and `review_training` — tool order plus the intensity split (at most two hard sessions, other rides under 75% FTP). The same guidance is on the server `instructions` field, which ChatGPT reads at startup.

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
