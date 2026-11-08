---
name: OpenTrainer
description: A light paper cockpit for indoor rides. Cool ground, cobalt numbers, quiet controls.
colors:
  cobalt: "#1b4fd8"
  metric-cobalt: "#153db8"
  on-cobalt: "#ffffff"
  cool-paper: "#f4f6f8"
  ink: "#121417"
  slate: "#3d4853"
  panel: "#ffffff"
  steel-line: "#9aa8b5"
  inset: "#e8ecf0"
  wash: "#dde5ee"
  status-ok: "#1b8a4a"
  status-warn: "#b8860b"
  status-warn-text: "#6b4e00"
  status-danger: "#c4332b"
  status-danger-text: "#8b1e18"
  zone-1: "#6b7c8a"
  zone-2: "#3d8fd4"
  zone-3: "#3d9a6a"
  zone-4: "#d4a017"
  zone-5: "#d47a2a"
  zone-6: "#d4534a"
  zone-7: "#9b5de5"
typography:
  display:
    fontFamily: "Source Code Pro, ui-monospace, monospace"
    fontSize: "clamp(3.75rem, 17vw, 6.25rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Source Sans 3, Segoe UI, sans-serif"
    fontSize: "clamp(1.35rem, 3vw, 1.6rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Source Sans 3, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Source Sans 3, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0em"
  label:
    fontFamily: "Source Sans 3, Segoe UI, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.02em"
rounded:
  control: "0.4rem"
  row: "0.5rem"
  swatch: "2px"
spacing:
  xs: "0.35rem"
  sm: "0.5rem"
  md: "0.85rem"
  lg: "1rem"
  xl: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.cobalt}"
    textColor: "{colors.on-cobalt}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.85rem"
  button-primary-hover:
    backgroundColor: "color-mix(in srgb, #1b4fd8 88%, black)"
    textColor: "{colors.on-cobalt}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.85rem"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.85rem"
  button-danger:
    backgroundColor: "color-mix(in srgb, #c4332b 16%, #ffffff)"
    textColor: "{colors.status-danger-text}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.85rem"
  button-tab:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "0"
    padding: "0.5rem 0.65rem"
  button-tab-active:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "0"
    padding: "0.5rem 0.65rem"
  input:
    backgroundColor: "{colors.inset}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.65rem"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0.85rem 1rem"
  banner-warn:
    backgroundColor: "color-mix(in srgb, #b8860b 18%, transparent)"
    textColor: "{colors.status-warn-text}"
    rounded: "{rounded.control}"
    padding: "0.55rem 0.75rem"
---

# Design System: OpenTrainer

## Overview

**Creative North Star: "The Paper Cockpit"**

OpenTrainer is a paper instrument meant to be read from the bike. The ground is cool and light. White panels sit on it inside a steel line. Live watts are the only type allowed to shout. Everything else stays quiet so that number can be read at a glance under ordinary room light.

The climate is light only and does not follow the operating system. At rest the screen is a centered column: a tab bar, then stacked panels. When a ride is in progress the column opens wide and the chrome tightens. Controls are compact, slightly rounded, and bordered. Figures are a second voice: heavy monospace, tabular, and metric cobalt while the reading is live.

The system rejects a dim instrument theater, a warm cream studio, and harsh pure black on pure white. Green, amber, and red report state. Cobalt is the only interactive accent.

**Key Characteristics:**

- Cool paper ground, white panels, steel borders
- Live watts as the largest type, in heavy monospace
- One cobalt accent; green, amber, and red stay status
- Flat at rest; a shadow only when a layer floats
- Compact bordered controls that stay quieter than the numbers

## Colors

Cool paper, ink, and one cobalt. Status hues are instruments, not branding.

### Primary

- **Cobalt** (`#1b4fd8`): The only interactive accent. Primary actions, the active tab underline, text links, the chart stroke, and today’s calendar border.
- **Metric Cobalt** (`#153db8`): Live watts and other fresh figures. Same hue as Cobalt, darker, so a number reads as a reading rather than as a button. Stale or missing figures drop to Slate.
- **On Cobalt** (`#ffffff`): Label on a primary button.

### Neutral

- **Cool Paper** (`#f4f6f8`): Page ground. A faint **Cool Wash** (`#dde5ee`) sits in a radial gradient at the top of the page and then disappears.
- **White Panel** (`#ffffff`): Panels, the tab bar, the power readout, and secondary buttons.
- **Ink** (`#121417`): Primary text. Near-black, not pure black.
- **Slate** (`#3d4853`): Supporting copy, labels, units, and stale readings.
- **Steel Line** (`#9aa8b5`): The 1px border on panels, controls, inputs, tables, and tab bar.
- **Inset** (`#e8ecf0`): Field fill, sensor group background, and code blocks. A step down from the white panel, not a shadow.

### Status

- **Signal Green** (`#1b8a4a`): Connected, and a completed ride on the calendar.
- **Signal Amber** (`#b8860b`) with **Amber Ink** (`#6b4e00`): Reconnect, a warning banner, and a scheduled ride on the calendar. Amber Ink is the text on a pale amber wash.
- **Signal Red** (`#c4332b`) with **Red Ink** (`#8b1e18`): Errors and the stop action. Red Ink is the text; the button fill is a pale red wash on white.

### Power zones

Chart swatches only, one per Coggan zone, as a 2px-corner square beside the axis. They are not UI accents.

- **Zone 1** (`#6b7c8a`)
- **Zone 2** (`#3d8fd4`)
- **Zone 3** (`#3d9a6a`)
- **Zone 4** (`#d4a017`)
- **Zone 5** (`#d47a2a`)
- **Zone 6** (`#d4534a`)
- **Zone 7** (`#9b5de5`)

### Named Rules

**The Paper Climate Rule.** The cockpit stays light (`color-scheme: light`). It does not follow the operating system, and it does not grow a dark theme.

**The Status-Only Rule.** Green, amber, and red report connection, warning, error, and calendar ride state (amber for scheduled, green for completed). They are not decoration and they are not the primary action.

**The One Accent Rule.** Cobalt is the only interactive accent. Metric cobalt is that same hue used for live numbers, not a second brand color.

## Typography

**Display / figures:** Source Code Pro (with ui-monospace, monospace)
**Interface:** Source Sans 3 (with Segoe UI, sans-serif)

**Character:** The sans face is a quiet grotesque for labels and sentences. The mono face is the instrument: heavy, tight, and tabular, so watts can be read from the saddle.

### Hierarchy

- **Display** (800, `clamp(3.75rem, 17vw, 6.25rem)`, line-height 0.95, tracking `-0.045em`): Live watts at rest. While riding, the same figure steps down to `clamp(3.25rem, 9vw, 5.25rem)` so the chart can sit with it. The unit is 0.35em, weight 600, Slate, and sits above the baseline.
- **Headline** (700, `clamp(1.35rem, 3vw, 1.6rem)`, line-height 1.2, tracking `-0.02em`): The page title on every tab.
- **Title** (700, 1.25rem, line-height 1.25, tracking `-0.02em`): A session name in History and on the calendar. Panel headings are smaller: 0.9rem at weight 650.
- **Body** (400, 1rem, line-height 1.4): Default reading text. Supporting lines are 0.85rem in Slate, held to about 42rem.
- **Label** (600, 0.72rem, tracking `0.02em`, uppercase): Names beside live metrics and the ride-intensity control. Section labels in a sensor group use the same size without uppercase.

### Named Rules

**The Two Voices Rule.** Source Sans 3 carries labels and prose. Source Code Pro carries watts, durations, and any figure a rider compares. A live number is never set in the sans face.

**The Glance Rule.** On the ride screen the live watt figure is the largest type. No headline competes with it.

## Layout

One centered column. At rest the content width is `min(72rem, 100%)`, with page padding `1.1rem 1.15rem 2.5rem` and a 1rem gap under the tab bar. Panels stack at 0.85rem. Panel padding is `0.85rem 1rem`. History uses a looser block: `1.5rem 1.6rem`, with session cards inside it.

The tab bar is the only app navigation. It spans the content width: Ride, Devices, History, Calendar, Profile. While a workout is running the column opens to `min(120rem, calc(100vw - 1.25rem))`, padding drops to `0.55rem 0.5rem 1.25rem`, the stack gap drops to 0.65rem, and the chart grows to `clamp(22rem, 56vh, 40rem)`. The tab bar fades to 80% opacity.

The live readout is three columns: body metrics, the watt figure, session metrics. Below 28rem the watts span the row and the rails drop underneath. From 40rem the device toolbar splits into a title and actions. The page’s minimum width is 320px.

### Named Rules

**The Ride-Opens Rule.** Resting screens stay in the centered column. A ride in progress may go wide and shorten the padding. Do not keep the resting margins once the workout is running.

## Elevation & Depth

Flat by default. Depth is a change of surface, not a lift. Cool Paper is the ground, with a soft wash at the top. White Panel is the next step, separated by a 1px Steel Line. Inset is the step down, used for fields and grouped sensors. History rows add a hairline inset highlight (`inset 0 1px 0` at 4% ink). The active tab is an inset 2px Cobalt underline, not a raised tab.

### Shadow Vocabulary

- **Floating menu** (`box-shadow: 0 8px 24px color-mix(in srgb, #000 35%, transparent)`): The device menu that opens over the page. Nothing else casts a shadow.

### Named Rules

**The Flat-by-Default Rule.** Surfaces are flat at rest. A shadow appears only when a layer floats over the page. Panels, cards, and buttons do not carry a resting shadow.

## Shapes

Controls, panels, inputs, banners, and calendar days share one corner (0.4rem). History session cards step slightly larger (0.5rem). Zone swatches are nearly square (2px). Sensor dots and calendar ride marks are circles. Tabs are square; the bar that holds them uses the shared corner. Borders are a 1px Steel Line. Charts are not clipped into rounded frames.

### Named Rules

**The One Corner Rule.** Controls, panels, inputs, and banners use a 0.4rem corner. Do not add a pill button or a sharp rectangle beside that corner.

## Components

Restrained and precise. Controls stay quieter than the numbers. Borders and a short color change do the work that a shadow would do somewhere else. Buttons move in 120ms (border, fill, opacity). A focused button draws a 2px Cobalt outline, 2px outside the control. A disabled control drops to 50% opacity.

### Buttons

- **Shape:** Shared corner (0.4rem). Default padding `0.5rem 0.85rem`. Weight 600, size 0.9rem, Source Sans 3.
- **Primary:** Cobalt fill, On Cobalt text, Cobalt border. Hover darkens the fill (`color-mix` of Cobalt at 88% with black) and the border (85% with black). Start is this button with more padding (`0.65rem 1.2rem`) and a 0.95rem size.
- **Secondary:** White Panel fill, Ink text, Steel Line border. Hover shifts the border toward Cobalt (45% Cobalt mixed into the steel).
- **Danger:** Pale Signal Red wash on white (16% red), Red Ink text, a border that is 55% red mixed into steel. Hover turns that border solid Signal Red. Used for Stop.
- **Text button:** No border, no fill, Cobalt text, underlined, 0.8rem, weight 600. Hover shifts the text to Metric Cobalt.

### Cards / Containers

- **Corner style:** Shared corner (0.4rem). History session cards use the larger row corner (0.5rem) and a recessed fill (55% white mixed into Inset).
- **Background:** White Panel on Cool Paper.
- **Shadow strategy:** None at rest. See Elevation.
- **Border:** 1px Steel Line.
- **Internal padding:** `0.85rem 1rem`. History blocks use `1.5rem 1.6rem`.

### Inputs / Fields

- **Style:** Inset fill, 1px Steel Line, shared corner, padding `0.5rem 0.65rem`. Type inherits the sans face.
- **Focus:** No separate glow. The steel border remains the edge.
- **Disabled:** Not a distinct chrome. Empty and read-only profile values are text, not fake fields.

### Navigation

A single row of equal tabs inside a white bar with a steel border. Inactive tabs are Ink at 55% opacity. Hover rises to 85% and shows a faint mixed underline. The active tab is full Ink with a 2px inset Cobalt underline and no fill change. There is no second nav and no mobile drawer. Below the riding layout the same bar stays, at 80% opacity.

### Banners

A full-width note with the shared corner and 0.85rem type. Warning is an 18% amber wash with Amber Ink. Error is a 16% red wash with Red Ink.

### Calendar day

A short tile (aspect about 2.4), Inset fill, steel border, shared corner. Today takes a Cobalt border. The selected day takes a Cobalt border and an 18% Cobalt wash on white. Ride marks are 0.32rem circles: Signal Amber for scheduled, Signal Green for completed.

### Live watts

The signature of the cockpit. Centered in a white panel. The figure is Display type in Metric Cobalt, tabular, with the unit in Slate. Stale or missing watts switch to Slate. Side metrics use the same mono face at `clamp(1.25rem, 2.8vw, 1.7rem)`, weight 800, and turn Metric Cobalt only while fresh. Their labels are the uppercase Label style, in a fixed 4.25rem column.

### Session figures

In History and on the calendar, each figure is a label (0.82rem, weight 600, Slate) over a mono number (1.2rem, weight 800, Ink). Compared numbers sit in a row with 1.4rem between them.

## Do's and Don'ts

### Do

- **Do** keep the cockpit light-only, on Cool Paper (`#f4f6f8`) with Ink (`#121417`).
- **Do** use Cobalt (`#1b4fd8`) for the primary action, the active tab underline, links, and today on the calendar.
- **Do** set live watts and compared figures in Source Code Pro, weight 800, tabular numerals, Metric Cobalt (`#153db8`) when fresh.
- **Do** draw panels and controls with a 1px Steel Line (`#9aa8b5`) and a 0.4rem corner.
- **Do** mark connection and errors with Signal Green, Signal Amber, and Signal Red, including the small calendar dots.

### Don't

- **Don't** add a dark theme or follow the OS appearance.
- **Don't** use green, amber, or red as a brand accent or a primary button.
- **Don't** put a resting shadow on panels, cards, or buttons.
- **Don't** set live watts in Source Sans 3, or let a page title outsize them on the ride screen.
- **Don't** introduce a second accent, a pill radius, or pure black on pure white.
