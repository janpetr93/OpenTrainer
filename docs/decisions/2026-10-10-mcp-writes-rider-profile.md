---
date: 2026-10-10
status: active
---

# MCP is the write path for Rider Profile (FTP / Training Intent)

## Context

**Rider Profile** (**FTP**, derived **Power Zones**, optional **Training Intent**) was writable from both the Profile tab UI (`PUT /api/profile`, `PUT /api/profile/intent`) and MCP (`set_ftp`, `set_training_intent`). Week planning already treats the AI coach as the place that asks for and sets FTP/Intent. Duplicate UI editors competed with that flow and invited drift between “set in Profile” and “set in chat.”

## Decision

- **MCP** (via **Local Store**) is the only product write path for **FTP** and **Training Intent**.
- The Profile tab **reads** FTP, zones, and Intent (refreshable mirror); it does not edit them.
- Remove companion HTTP `PUT /api/profile` and `PUT /api/profile/intent` (and web client helpers). Keep `GET /api/profile`.
- Empty-state / blocked-workout copy points riders to set FTP/Intent via MCP (chat), not the Profile tab.
- Scope is **Rider Profile only** — **Strava Link**, workouts, calendar, and ride controls stay UI-writable where they already are.

## Alternatives considered

- **A — Read-only Profile + remove PUTs (chosen)** — single write path; UI still shows current values for riding/charts.
- **B — Hide FTP/Intent from Profile entirely** — rejected; riders still need a glanceable FTP/zones/Intent mirror.
- **C — Keep PUTs as a hidden escape hatch** — rejected; extra surface without a product owner.

## Consequences

- Supersedes the “Profile tab UI can set Intent/FTP” part of [training-intent-not-chat-only](2026-10-10-training-intent-not-chat-only.md); Intent still lives in Local Store, but only MCP mutates it from the product surface.
- Copy that said “set FTP on the Profile tab” now points at MCP.
- Tests that mutated profile via HTTP should use `LocalStore` / MCP instead.
