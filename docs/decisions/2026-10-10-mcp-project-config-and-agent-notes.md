---
date: 2026-10-10
status: active
---

# MCP project configs, `--silent`, and AGENTS.md

## Context

A fresh-clone setup report (Claude Code on macOS) found that MCP worked, but onboarding was friction-heavy: no committed project MCP config, `npm run mcp` leaked lifecycle banners onto stdio, and agents lacked a short run/MCP cheat sheet.

## Decision

- Commit **both** [`.mcp.json`](../../.mcp.json) (Claude Code) and [`.cursor/mcp.json`](../../.cursor/mcp.json) (Cursor) with the same entry: `npm run --silent mcp --prefix companion`.
  `.gitignore` still ignores `.cursor/` but un-ignores `.cursor/mcp.json` so the project MCP config can ship.
- Use `npm run --silent` in all MCP launch docs and the root `mcp` script so stdout stays JSON-RPC-clean.
- Add a single [AGENTS.md](../../AGENTS.md) (not also `CLAUDE.md`) for agent run/MCP/data notes.
- README points at the committed configs for Cursor / Claude Code; Claude Desktop and ChatGPT keep abbreviated host-specific examples.

## Alternatives considered

- **Root `.mcp.json` only** — leaves Cursor without a committed project config (docs previously assumed `.cursor/mcp.json`).
- **`.cursor/mcp.json` only** — worse for Claude Code, which expects root `.mcp.json`.
- **`CLAUDE.md` only or dual files** — Claude-specific or drift-prone; one `AGENTS.md` is enough for agents in this repo.
- **README-only `--silent`** — other paths (`companion/README.md`, ChatGPT week-planning doc, root script) would keep the banner bug.

## Consequences

- Opening the repo in Cursor or Claude Code can offer the MCP server without hand-written absolute paths.
- Callers must still `npm install --prefix companion` first; missing `tsx` still fails quietly at the client — called out in `AGENTS.md` and the root README.
- MCP tool lists still load at session start; restart after config changes remains required.
