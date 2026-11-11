---
date: 2026-11-11
status: active
---

# Calendar Blocker, separate from a Scheduled Ride

## Context

Week planning is holistic: the same two weeks include trainer rides, other sports, and social plans. The [Training Calendar](../../CONTEXT.md) only had **Scheduled Ride**s (a **Workout** you can start) and past **Activity**s. Putting a run on a **Scheduled Ride** would invent a **Workout** and a Start action. [Training Intent](../../CONTEXT.md) still keeps the weekly availability pattern in chat, not on a calendar.

## Decision

A **Blocker** is its own dated mark on the **Training Calendar**. It has no **Workout** and cannot be started. Kind is social, or a sport: run, gym, or swim. Week planning reads and writes **Blocker**s next to **Scheduled Ride**s. Only a **Scheduled Ride** is actionable on the trainer. A planned run stays a **Blocker**.

A **Blocker** occupies a start time and a duration in minutes, or the whole day when there is no useful clock time. A **Scheduled Ride** must not overlap that window. A morning run leaves the evening open. An all-day trip takes the whole local day.

MCP is the only write path for a **Blocker** (list, create, change, remove, clear a range). The **Training Calendar** shows **Blocker**s and cannot add, change, or remove one. This matches **FTP** and **Training Intent**. It does not change **Schedule again**, calendar delete, or skip on a **Scheduled Ride**, and it does not change recording an **Activity** by riding. The [Rider Profile write decision](2026-10-10-mcp-writes-rider-profile.md) left the calendar UI-writable for rides; a **Blocker** does not use that opening.

Several **Blocker**s may share a day when their windows do not overlap. A sport **Blocker** and an easy **Scheduled Ride** may share that day: run at 07:00, easy trainer ride in the evening. Easy means session kind easy (steady work under 76% FTP). A hard **Scheduled Ride** (88% FTP or more, or six short efforts at 110% or more) or a moderate one (steady work at 76–94% FTP) on a day that has a sport **Blocker** is a `check_training_week` violation. A social **Blocker** does not change that day's training load.

A **Blocker** may carry an optional short label ("dinner", "easy 50 min"). The pictogram comes from the kind: social, run, gym, or swim. An empty label still has an icon and a time. The calendar cannot edit the label.

On the month grid, day cells use a left number and a right stack of mono letter chips (see `2026-11-11-calendar-cell-layout.md`): `B` bike, `R` run, `G` gym, `W` swim, `E` event/social. Planned bike is amber wash; completed bike is solid green; Blockers stay panel + steel so they do not read as ride state. The day-detail rows use the same chips, slightly larger. A past **Blocker** stays the same chip: OpenTrainer does not record that run, gym session, or swim, so there is no done state and no **missed** state. On the day, a **Blocker** is a short row — letter chip, label, and time — with no planned **Power Profile** and no Start. Ride rows stay as they are.

The **Calendar Mirror** copies a **Blocker** onto the same dedicated OpenTrainer Google calendar as a **Scheduled Ride**. The title is the label, or the kind name when the label is empty. The time is the window, or the whole day. Delete and clear remove the Google event. A past **Blocker** stays until MCP removes it. A drag in Google does not move it. First connect copies **Blocker**s from the start of the local day onward, same as planned rides. **Activity**s stay uncopied.

Replacing a date range clears **Blocker**s and **Scheduled Ride**s through separate tools, then the model writes both back. Clearing rides leaves **Blocker**s in place. `check_training_week` reports a **Scheduled Ride** that overlaps a **Blocker**, two **Blocker**s that overlap each other, and a hard or moderate **Scheduled Ride** on a day with a sport **Blocker**. The planning prompt tells the model to read **Blocker**s, and to clear both when it replaces a range. The weekly availability pattern is still asked in chat when it is not already a **Blocker**. A **Blocker** does not appear on the Ride tab.

## Alternatives considered

- **A sport as a Scheduled Ride that cannot be started** — forces a fake **Workout** onto run, gym, and swim, and blurs the only startable object.
- **Store the marks only in the Training Intent note** — the planner can read them, but they never appear on the calendar.
- **Keep asking in chat and store nothing** — already the rule for the weekly pattern; it drops dated marks the moment the chat is gone.
- **A calendar form for Blockers** — a second write path. Rejected: plans enter through MCP, same as **FTP** and **Training Intent**.

## Consequences

- **Training Intent** constraints (hard-day cap, long-ride weekday) stay where they are.
