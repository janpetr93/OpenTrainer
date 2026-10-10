---
date: 2026-10-09
status: active
---

# Specs include Power Profile (not mean-maximal curve)

> Partial supersession: lifetime **Mean Maximal Power** on Profile is now in scope — see [mean-maximal-power-on-profile](2026-10-10-mean-maximal-power-on-profile.md). Session charts remain **Power Profile**.

## Context

User wants “power curve” on both **Workout** and **Activity** (planned; achieved vs planned). In cycling, “power curve” often means mean-maximal bests.

## Decision

Use the term **Power Profile**: watts over elapsed time.

- **Workout Specs**: name, steps, planned **Power Profile**
- **Activity Specs**: start, duration, avg/max power, achieved **Power Profile**, plus planned overlay when a **Workout** was followed
- Mean-maximal / MMP charts out of scope for session specs (Profile MMP is a separate feature)
- Never invent HR/cadence

## Alternatives considered

- **Call it “power curve”** — collisions with MMP language in coaching tools.
- **Include NP/TSS/IF in v1 Activity specs** — deferred; profile + avg/max/duration first.

## Consequences

- UI, MCP `list_activities` / `create_workout`, and export metadata should speak **Power Profile**.
- Free-ride (no plan) case still needs a rule for missing planned overlay.
