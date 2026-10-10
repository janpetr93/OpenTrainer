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
- MCP docs: document **Cursor + Claude Desktop** (stdio) fully; for **ChatGPT**, document **OpenAI Secure MCP Tunnel** walkthrough (no remote HTTPS MCP in-repo yet).
- Keep env vars `D100_*` for local compatibility; MCP server id / package names use `open-trainer*`.

## Alternatives considered

- **Private GitHub / Cursor-hosted** — rejected for “open among friends” goal.
- **ChatGPT docs without tunnel** — would oversell; ChatGPT cannot spawn local stdio.
- **Build remote HTTPS MCP now** — deferred; larger lift than first public push.
- **Empty store only** — rejected; samples help first MCP demos.
- **Surface-only rename** — rejected; public tree should say OpenTrainer consistently.

## Consequences

Friends clone OpenTrainer, run UI + local MCP easily; ChatGPT needs Platform tunnel + `tunnel-client`. Personal rides/Strava tokens stay on the author’s machine via gitignore. Future remote MCP would be a separate decision.
