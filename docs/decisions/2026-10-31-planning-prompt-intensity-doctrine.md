---
date: 2026-10-31
status: active
---

# Planning prompts carry an intensity doctrine

## Context

`plan_training_week` and `review_training` were tool checklists. They stored **FTP**, Coggan zones, **Session Load**, and **Mean Maximal Power**, but did not say what a hard day is or how to split a week. An unguided model fills indoor weeks with tempo. Zone steps also resolve to the band midpoint, so `zone: 3` is ~82% FTP (not sweet spot) and `zone: 5` is ~112% FTP.

Research reviewed this session (Neal 2013, Seiler 2010 and 2013, Rønnestad 2014–2021, Rosenblat 2019 and 2025, the 2024 cyclist meta-analysis, Borszcz 2018, Inglis 2020) supports a pyramidal week for time-limited riders, two specific HIT shapes, and treating 20 min MMP × 0.95 as a group hint rather than an individual **FTP**.

## Decision

Put the doctrine in the MCP prompt text and in the `create_workout` / `get_mmp` descriptions. No schema change.

- At most two hard sessions, easy day between them, every other ride under 75% FTP. Sweet spot (88–94% FTP) counts as hard and replaces a second HIT day only when the week is about 6 hours or less.
- Quality steps use `percentFtp`. Zone only for Z1–Z2. Never zone 6 or 7 (ERG cannot sprint).
- HIT shapes to hold 2–3 weeks: 4×8 min at 105–108% FTP, or 30 s / 15 s repeats. Add a repeat before raising the percent. Every 3rd or 4th week, cut duration and keep one hard session. Block week lives in the **Training Intent** note.
- **Estimated FTP** is not written back. No fixed indoor FTP discount. Tell the rider to use a fan above tempo.

## Alternatives considered

- **Ramp steps, a training-summary tool, or CTL/ATL first** — deferred. Existing steps and `timeInZonesSec` can express the week; the model was missing rules, not fields.
- **A stored training phase** — rejected. Phase stays inferred; the Intent note already holds “week 2 of 4×8”.
- **Auto-apply Estimated FTP** — rejected. Individual error is tens of watts, and the profile rule is already never auto-write.

## Consequences

- Prompts are longer. Zone 3–7 remain valid in the schema; the coach is told not to use them for quality work.
- The ~6 hour split is a planning cutoff so the model can choose one HIT plus sweet spot versus two HIT days. It is not a physiological threshold.
- ChatGPT paste in `docs/mcp-chatgpt-week-planning.md` matches the prompt, because that paste is what a client uses when it does not load the MCP prompt.
