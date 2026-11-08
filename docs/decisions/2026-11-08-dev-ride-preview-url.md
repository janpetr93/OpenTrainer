---
date: 2026-11-08
status: active
---

# Dev Ride preview URL

## Context

The in-ride layout (chart, painted watts, time left, Pause / Skip / Stop) appears only while a **Workout** is running or paused, and Start needs a **Trainer** **Connection**. Judging that screen meant starting a real ride.

## Decision

`?preview=ride` on the Vite dev server paints one frozen moment of a **Workout** in progress on the real Ride screen. Pause, Skip, and Stop only leave that picture. The query does nothing in a production build.

It is not an **Activity**, not a **Connection**, and it does not write the **Local Store** or send ERG.

## Alternatives considered

- **A clock that advances** — useful later for motion, unnecessary for judging the layout, and easier to mistake for a live ride.
- **A button on the Ride tab** — always in the way while developing the idle screen. A URL keeps the idle Ride tab clean.
- **Available in the packaged app** — a rider could open a fake connected **Trainer**.

## Consequences

- Open `http://localhost:5173/?preview=ride` while `npm run dev` is running.
- Refresh keeps the preview. Stop (also Pause and Skip) removes the query and returns to the idle Ride tab.
