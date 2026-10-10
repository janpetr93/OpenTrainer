# ChatGPT + OpenTrainer MCP (Secure MCP Tunnel)

OpenTrainer’s MCP server is **stdio-only** (`npm run mcp`). ChatGPT cannot spawn that process itself. Use [OpenAI Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) so ChatGPT talks to OpenAI’s hosted tunnel endpoint while `tunnel-client` on your machine forwards requests to the local MCP server.

For **Cursor** and **Claude Desktop**, prefer local stdio — see the root [README.md](../README.md). This doc is ChatGPT-specific.

## Prerequisites

- Node.js + deps installed (`cd companion && npm install`)
- An OpenAI Platform account with permission to create/use **tunnels**
- ChatGPT workspace permission to add a **custom MCP server**
- [tunnel-client](https://github.com/openai/tunnel-client) (download from [Platform tunnel settings](https://platform.openai.com/) or the latest GitHub release)

## 1. Create a tunnel

1. Open Platform **tunnel settings** and create a tunnel.
2. Note the `tunnel_id` (looks like `tunnel_…`).
3. Create or copy a **runtime API key** for `tunnel-client`.
4. Associate the tunnel with the **ChatGPT workspace** you will use (not only a personal Platform org), or it may not appear in ChatGPT.

## 2. Point tunnel-client at OpenTrainer MCP

From a machine that has this repo and can reach outbound `api.openai.com:443`:

```bash
export CONTROL_PLANE_API_KEY="sk-..."   # tunnel runtime key from Platform

# Replace paths with your clone of OpenTrainer
tunnel-client init \
  --sample sample_mcp_stdio_local \
  --profile open-trainer \
  --tunnel-id tunnel_YOUR_ID_HERE \
  --mcp-command "npm run mcp" \
  --mcp-cwd "/ABSOLUTE/PATH/TO/OpenTrainer/companion"

tunnel-client doctor --profile open-trainer --explain
tunnel-client run --profile open-trainer
```

If your `tunnel-client` build does not support `--mcp-cwd`, use an absolute command instead:

```bash
tunnel-client init \
  --sample sample_mcp_stdio_local \
  --profile open-trainer \
  --tunnel-id tunnel_YOUR_ID_HERE \
  --mcp-command "npx tsx /ABSOLUTE/PATH/TO/OpenTrainer/companion/src/mcp/server.ts"
```

Keep `tunnel-client run …` healthy while using ChatGPT. Check the local admin UI (`/ui`) or `doctor` if discovery fails.

Exact `init` flags can evolve — when in doubt run `tunnel-client help quickstart` and follow the current Secure MCP Tunnel guide.

## 3. Add the MCP server in ChatGPT

1. ChatGPT → **Plugins** (or custom MCP / apps settings) → **Add custom MCP server**.
2. Connection: **Tunnel**.
3. Select your tunnel or paste the `tunnel_id`.
4. Configure auth if prompted (OpenTrainer MCP has **no OAuth** of its own — use “none” / skip if offered).
5. Accept the risk warning and create.

If the tunnel does not list: workspace association + Tunnels **Use** permission + running `tunnel-client`.

## 4. After reconnect — week-plan paste

If ChatGPT says it can only create workouts (no calendar / no FTP), it is on a **stale MCP session**. Restart the connector / tunnel client so it loads companion MCP `0.3.1+`, then paste:

```text
You have OpenTrainer MCP v2. Do not claim calendar/FTP are unavailable.

Week-plan workflow:
1. get_rider_profile — if FTP is null, ask me and set_ftp
2. list_activities (pastDays 14) + list_scheduled_rides for next week
3. clear_scheduled_rides for that week’s since/until if replacing the plan
4. create_workout with percentFtp or zone on every working step (not null targets)
5. create_scheduled_ride for each day (workoutId + startsAt ISO)
6. Summarize dates, names, and %FTP/zone

Prefer zone / %FTP over absolute watts. Never invent Activities.
```

## Tools it should see

`get_rider_profile`, `set_ftp`, `list_workouts`, `create_workout`, `list_activities`, `list_scheduled_rides`, `create_scheduled_ride`, `delete_scheduled_ride`, `clear_scheduled_rides`, plus prompt `plan_training_week`.

## Notes

- MCP shares the same Local Store as the web UI (`companion/data/`). It does **not** need the HTTP companion or Bluetooth.
- Sample workouts `sample-easy-endurance` and `sample-vo2-intervals` ship in the repo for demos.
- Claude.ai (browser) also needs a remote/tunneled MCP — same tunnel idea does not apply there; use **Claude Desktop** with stdio instead.
