---
date: 2026-10-10
status: active
---

# OpenTrainer public release shape

## Context

Share the trainer app as a public GitHub repo for friends. Need clear product naming, license, what personal data ships, and how honestly to document ChatGPT MCP given stdio-only companion MCP today.

## Decision

- Product / repo name: **OpenTrainer** (local disk folder may stay `UntitledTrainer`).
- Host: **public GitHub**, MIT license, copyright **Jan Petr** (2026).
- Scrub: ignore all Local Store runtime data; ship **two anonymized sample workouts** only.
- MCP docs: document **Cursor + Claude Desktop + ChatGPT desktop** (stdio). Browser chatgpt.com is out of scope for local stdio (no tunnel as primary path).
- Keep env vars `D100_*` for local compatibility; MCP server id / package names use `open-trainer*`.

## Alternatives considered

- **Private GitHub / Cursor-hosted** — rejected for “open among friends” goal.
- **ChatGPT via Secure MCP Tunnel as primary docs** — rejected after confirming ChatGPT **desktop** already works with STDIO (Settings → MCP servers); tunnel only matters for chatgpt.com.
- **Build remote HTTPS MCP now** — deferred; not needed for desktop clients.
- **Empty store only** — rejected; samples help first MCP demos.
- **Surface-only rename** — rejected; public tree should say OpenTrainer consistently.

## Consequences

Friends clone OpenTrainer and wire MCP the same way on Cursor, Claude Desktop, and ChatGPT desktop. Personal rides/Strava tokens stay on the author’s machine via gitignore.
