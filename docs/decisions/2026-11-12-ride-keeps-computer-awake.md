---
date: 2026-11-12
status: active
---

# Space pauses a ride, and a ride keeps the computer awake

## Context

A rider's Mac went to sleep a few minutes into a ride in the desktop app. Nothing in OpenTrainer held the display or the Mac awake, so the system idle timer (or a tool like Amphetamine) was free to sleep it. Sleep drops the trainer and sensor Bluetooth links, which ends the ride in practice.

The same rider wanted to pause from the keyboard. Clicking Pause, Resume or a ±% button on a trackpad also opened macOS Look Up (the dictionary) over the ride.

## Decision

**Keep awake.** While a ride runs or is paused (`rideHoldsTheWindow`), the app keeps the display, and so the computer, awake:

- **Desktop app:** the page asks the main process over IPC (`power:keep-awake`). The main process holds one Electron `powerSaveBlocker` of type `prevent-display-sleep`. It is released when the ride stops, completes, or the page navigates, reloads, crashes, or closes.
- **Chrome / Edge:** the Screen Wake Lock API. The browser drops the lock whenever the tab is hidden, so it is requested again each time the page becomes visible.

**Space.** Space pauses a running ride and resumes a paused one, on every tab, like the other ride keys. While a ride runs or is paused, Space is blocked on keydown and keyup outside text fields, so it never also presses the last clicked button (Stop included), not even when held.

**No text selection on the ride.** Buttons are `user-select: none` everywhere, and the whole ride screen is while riding. Chromium resolves the Look Up word through the same position lookup as selection, which skips unselectable text. This is read from the engine's behavior, not yet confirmed with a physical Force Click.

## Alternatives considered

- **Wake Lock in the desktop app too:** Electron supports it, but the lock goes away when the window is hidden behind another app. The main-process blocker does not.
- **Only `prevent-app-suspension`:** keeps the Mac running but lets the display sleep. The rider needs the screen, and a sleeping display is what idle-sleep tools act on.
- **Blur buttons after a click:** fixes Space on a focused button, but breaks keyboard focus for Tab users. Blocking Space only while a ride holds the keys is narrower.

## Consequences

- A paused ride also keeps the computer awake. Stop the ride to let it sleep.
- Chrome cannot keep the computer awake while the ride tab is hidden. The desktop app can.
- While a ride runs, Space no longer scrolls the page or presses focused buttons on any tab.
- Closing a laptop lid or choosing Sleep still sleeps the computer. Only the idle timer is held off.
