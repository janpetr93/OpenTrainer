# OpenTrainer: agent notes

## Run

- Install: `npm install --prefix web && npm install --prefix companion`
- Start both: `./start.sh` (Ctrl+C stops both)
- Companion API: http://127.0.0.1:8787 (health: GET /api/health)
- Web UI (Vite): http://localhost:5173 (proxies `/api` to the companion)
- Ride / trainer features use Web Bluetooth and need desktop Chrome or Edge.
  Agents can verify the non-Bluetooth tabs (Calendar, History, Profile) only.

## Test

- `npm test` (runs web and companion Vitest suites)

## MCP

- Server: `npm run --silent mcp --prefix companion` (stdio).
  Configured in `.mcp.json` (Claude Code) and `.cursor/mcp.json` (Cursor).
- Requires `companion/` dependencies installed (`tsx` is a dev dependency);
  otherwise the client silently shows no tools.
- Tools load at session start. Restart the session after config changes.
- MCP reads and writes the same Local Store as the UI; it does not need the
  HTTP companion or Bluetooth.

## Data

- Local Store: `companion/data/` (gitignored except sample workouts).
- Override with the `D100_DATA_DIR` env var.
- FTP must be set (via the `set_ftp` MCP tool) before %FTP / zone targets resolve.
- Calendar Mirror (optional): `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `companion/.env`; connect on the Profile tab. Scheduled Ride writes mirror while the companion or MCP process is running. See `companion/README.md`.
- Mean Maximal Power: Profile tab Recompute (`POST /api/mmp/recompute`); MCP `get_mmp` is read-only.
