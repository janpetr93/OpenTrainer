# ChatGPT desktop + OpenTrainer MCP

OpenTrainer’s MCP is a **local stdio** process (`npm run --silent mcp`). Use the **ChatGPT desktop** app (Codex host) — not chatgpt.com in the browser.

Official overview: [ChatGPT MCP / Codex](https://learn.chatgpt.com/docs/extend/mcp.md).

## 1. One-time prep

```bash
cd /ABSOLUTE/PATH/TO/OpenTrainer/companion
npm install
```

You do **not** need `./start.sh` or the HTTP companion for MCP. ChatGPT starts its own MCP process. (HTTP is only for the web Workouts tab.)

## 2. Add the server

1. Open the **ChatGPT desktop** app.
2. **Settings** → **MCP servers**.
3. **Add server**.
4. Choose **STDIO**.
5. Fill in:

| Field | Value |
| --- | --- |
| **Name** | `open-trainer` |
| **Command** | `npm` |
| **Args** | `run`, `--silent`, and `mcp` (three args; or a single `run --silent mcp` string if the UI is one field). `--silent` keeps npm’s banner off MCP stdout. |
| **Working directory (cwd)** | Absolute path to `companion/`, e.g. `/Users/you/Projects/OpenTrainer/companion` (macOS/Linux) or `C:\Users\you\Projects\OpenTrainer\companion` (Windows) |

6. **Save**, then **Restart** when asked (or quit and reopen the app).

### If it fails

- **cwd must be absolute** (relative `companion` works in Cursor’s project config; ChatGPT desktop usually needs the full path).
- Ensure `npm` is on the PATH the desktop app sees (`which npm`; use that full path if needed).
- Alternate that often works better:

  | Field | Value |
  | --- | --- |
  | **Command** | `npx` |
  | **Args** | `tsx`, `src/mcp/server.ts` |
  | **cwd** | `/ABSOLUTE/PATH/TO/OpenTrainer/companion` |

## 3. Confirm it’s live

In a desktop chat composer:

```text
/mcp
```

You should see `open-trainer` with the tools listed below.

## 4. Week-plan paste (after reconnect)

If ChatGPT says it can only create workouts (no calendar / no FTP), it is on a **stale MCP session**. Restart the MCP server / app so it loads companion `0.3.1+`, then paste:

```text
You have OpenTrainer MCP v2. Do not claim calendar/FTP are unavailable.

Week-plan workflow:
1. get_rider_profile — if FTP is null, ask me and set_ftp
2. If Training Intent is null, ask once for goal (optional horizon/note) and set_training_intent — or continue without if I decline; never invent a goal
3. Ask what days I have available this week (not stored)
4. list_activities (pastDays 14) + list_scheduled_rides for next week — infer recent emphasis from Activities
5. clear_scheduled_rides for that week’s since/until if replacing the plan
6. create_workout with percentFtp or zone on every working step (not null targets)
7. create_scheduled_ride for each day (workoutId + startsAt ISO + purpose — Session Purpose: what the session is for, e.g. improve endurance)
8. Summarize dates, names, Session Purpose, and %FTP/zone tied to Intent + recent emphasis

Prefer zone / %FTP over absolute watts. Never invent Activities.
```

## Tools it should see

`get_rider_profile`, `get_mmp`, `set_ftp`, `set_training_intent`, `list_workouts`, `create_workout`, `list_activities`, `list_scheduled_rides`, `create_scheduled_ride`, `delete_scheduled_ride`, `clear_scheduled_rides`, plus prompt `plan_training_week`.

## chatgpt.com (browser)

Browser ChatGPT does **not** launch local stdio. Friends on desktop should use the steps above. Remote HTTPS MCP or [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) is only needed for the web product — not documented as the primary path here.
