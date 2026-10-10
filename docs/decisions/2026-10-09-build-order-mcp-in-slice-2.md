---
date: 2026-10-09
status: active
---

# Build order: MCP in slice 2 (after D100 proof)

## Context

Initial recommendation put MCP last (after runner, export, calendar). User re-scoped: MCP is high priority and should move far sooner. `create_workout` does not need Bluetooth; `list_activities` is empty until recording exists.

## Decision

1. **Slice 1** — Connection + Live Power + Control Probe (browser-only)
2. **Slice 2** — Local store + MCP companion (`create_workout`, `list_activities`; planned Power Profile on Workouts)
3. **Slice 3** — Workout runner + Activity recording (feeds list_activities)
4. **Slice 4** — FIT/TCX export + richer Power Profile UI
5. **Slice 5** — Training Calendar

MCP is not part of slice 1 (still prove D100 first). Slice 2 implies a local companion process and shared persistence sooner than a browser-only path would.

## Alternatives considered

- **MCP last** — rejected; user priority.
- **MCP inside slice 1** — mixes hardware risk with companion/persistence; delayed D100 proof.

## Consequences

- Persistence/companion architecture must be decided before/at slice 2.
- `list_activities` may return [] until slice 3 — acceptable.
