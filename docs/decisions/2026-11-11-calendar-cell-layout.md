---
date: 2026-11-11
status: active
---

# Calendar day cell: number + mark rail

## Context

Month cells must show a day number and usually one or two marks (ride state and/or a Blocker). Centered stacks in a short wide tile (`aspect-ratio` ~1.85) left no room for either: stamps felt heavy, bare icons felt unreadable, and custom stick figures looked amateur next to Lucide.

## Decision

Treat the cell as two zones that use the tile’s **width**:

1. **Day number** on the left, compact tabular type.
2. **Mark stack** on the right: at most two mono letter chips (`B` bike, `R` run, `G` gym, `W` swim, `E` event/social), then `+N`.

Chips carry status: amber wash for a planned bike, solid green for a completed bike, panel + steel border for a Blocker. The day-detail rows use the same chips (slightly larger) so the calendar has one mark language. Quiet days still reserve the right column so the grid rhythm does not jump.

## Alternatives considered

- **Centered number + Lucide icons** — both compete for space; icons do not hold at mark size.
- **Top number + bottom Lucide rail** — readable layout, but Lucide still muddies at ~1rem.
- **Stamp tiles behind every glyph** — heavy next to Inset day chrome.
- **Status dots only** — clear for ride state, but Blocker kinds disappear.
- **Unlimited wrapping icons** — overflows the cell.

## Consequences

The month grid is a letter scan, not an icon gallery. The legend must spell the letters. Days with three-plus items need the day panel. DESIGN.md “Calendar day” follows this layout.
