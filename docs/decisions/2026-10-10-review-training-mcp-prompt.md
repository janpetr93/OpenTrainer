---
date: 2026-10-10
status: active
---

# MCP prompt: review_training

## Context

`plan_training_week` materializes a week, but there was no first-class ritual to read Session Load / Adherence and calendar truth before replanning.

## Decision

Add MCP prompt `review_training` symmetric to `plan_training_week`: read profile, MMP, recent Activities (load/adherence), scheduled rides → summarize compliance/load → propose Intent note and/or next-week adjustments. Does not invent Activities; does not write the calendar unless the rider asks.

## Alternatives considered

- **Only document a chat recipe** — rejected: prompts travel with the MCP server.
- **New review tool that returns a canned summary** — deferred; LLM synthesis from raw tools is enough.

## Consequences

- README lists both prompts.
- Slice 4 outcomes make step 4 of the prompt more accurate once Scheduled Ride status lands.
