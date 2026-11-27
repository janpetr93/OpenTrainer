---
date: 2026-11-26
status: active
---

# An interrupted ride stays in progress

## Context

A 55-minute ride was discarded when the desktop window reloaded. The recording lived only in the page, and Stop was the only write. Reload (View menu, ⌘R) unloads that page: Bluetooth drops, the screen-lock releases, and nothing is saved. The process did not crash. Quit and a real crash lose the ride the same way.

The rider needs the recording to survive, and to continue the same ride rather than have the partial effort filed as a finished Activity. Auto-connect stays rejected: restoring the ride must not take the trainer from another app.

## Decision

- One **In-progress Ride** in the Local Store (`in-progress-ride.json`). It is not an Activity: it does not complete a Scheduled Ride, recompute Mean Maximal Power, or upload to Strava.
- The page writes it about once a second while the ride is running or paused, and again as the window hides. The desktop app writes that last flush synchronously so reload and quit keep the latest second.
- Opening OpenTrainer with that file restores the same ride, paused at the last saved second. Time the app was closed is not added. The rider re-pairs (the existing one click) and resumes. Resume asks the trainer for the current target again.
- Stop saves an Activity the same way as before and deletes the in-progress ride. Starting another ride saves the in-progress one first. Closing the app again leaves it paused and recoverable.
- If the Workout file is gone, the in-progress ride is saved as an Activity on the next open, because it can no longer be continued.

## Alternatives considered

- **Save an Activity as soon as the page unloads** — rejected. A reload one minute in would complete the Scheduled Ride, and the rider could not continue.
- **Block reload and quit** — rejected. A crash or a force-quit would still lose the ride, and the menu shortcut would fight the rider.
- **Auto-connect the trainer on restore** — rejected. Already decided: it can take the trainer from another app.

## Consequences

- A reload, quit, or crash comes back as a paused ride. History stays empty until Stop.
- At most about a second is missing if the process is killed between writes. Reload and quit on the desktop app flush the last second.
- The installed app keeps the old behavior until this build is shipped.
