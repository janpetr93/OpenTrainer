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
3. get_mmp. Estimated FTP is a hint only — do not call set_ftp from it
4. Call list_blockers for the range. A Blocker is stored time (social, run, gym, or swim). Ask only about time that is not already a Blocker. The weekly pattern is still not stored. Honor maxHardDaysPerWeek
5. get_training_summary (pastDays 14). Do not call list_activities for planning. lastHard.work.averageWatts at or above plannedWatts means add a repeat or minutes at the same percent. A lower average means keep the percent and do not add a repeat. Do not lower the percent because targetAdherence is low
6. list_scheduled_rides and list_blockers for the week you are writing. When replacing that range, clear_scheduled_rides and clear_blockers for the same since/until. A one-ride edit does not clear Blockers
7. create_workout with percentFtp on quality steps (sweet spot 88-94, 4x8 at 105-108). Hard-day warmup steps, in order: 5 min at 50% FTP, 5 min at 65%, 3 min at 80%, then 3 x (15 s at 120% FTP, 60 s at 50%). Those openers are warmup steps. Easy rides stay flat, under 75% FTP, with no bursts. For 30s/15s use a repeat item, do not unroll reps. Zone only for Z1-Z2. Never zone 6 or 7. At most two hard sessions, easy day between them, every other ride under 75% FTP. Name by training content only — no weekday or date
8. create_scheduled_ride for each trainer day (workoutId + startsAt ISO + purpose — Session Purpose: what the session is for, e.g. improve endurance). create_blocker for each run, gym, swim, and social mark (kind, startsAt, durationMin or allDay, optional label). A planned run is a Blocker, not a Workout
9. check_training_week for that week. Fix any violations, then check again. An easy ride may share a day with a run, gym, or swim when the windows do not overlap. A hard or moderate ride on that day is a violation
10. Summarize dates, names, Session Purpose, percentFtp, and Blockers. Ask before updating the Intent note (omitted fields are kept)

Do not lower FTP by a fixed indoor percentage. For work above tempo, remind me to use a fan. Never invent Activities.
```

## Tools it should see

`get_rider_profile`, `get_mmp`, `set_ftp`, `set_training_intent`, `get_training_summary`, `list_workouts`, `create_workout`, `list_activities`, `list_scheduled_rides`, `create_scheduled_ride`, `delete_scheduled_ride`, `clear_scheduled_rides`, `list_blockers`, `create_blocker`, `update_blocker`, `delete_blocker`, `clear_blockers`, `check_training_week`, plus prompts `plan_training_week` and `review_training`.

## chatgpt.com (browser)

Browser ChatGPT does **not** launch local stdio. Friends on desktop should use the steps above. Remote HTTPS MCP or [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) is only needed for the web product — not documented as the primary path here.
