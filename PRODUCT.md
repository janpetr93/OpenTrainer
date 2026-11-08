# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A self-coached indoor cyclist at home — the author and riders in the same situation. One rider per machine. They plan a training week with their own AI, ride a smart trainer, then review what they actually did and replan.

There is no coach account and no multi-rider roster.

## Product Purpose

OpenTrainer is a local indoor-cycling app. It connects to a smart trainer, runs power-target workouts, records the ride, and lets the rider’s own AI read and write the plan and the history.

Success is that loop on the rider’s machine: plan, ride, review, replan. The AI decides the structure of the week and of each session. The app is what makes that structure a ride with a recorded outcome.

## Positioning

The rider’s own AI materializes Workouts and Scheduled Rides into a local store, the app rides them, and the same tools can read the Activities afterward. A closed trainer app cannot offer that loop without owning the plan and the history.

Owning the files matters because it is how the loop stays on the rider’s machine. The difference is the loop, not the file format by itself.

## Operating Context

- At home, on the bike, using a laptop. The screen has to stay readable from the saddle under ordinary room light, especially live watts.
- A Bluetooth FTMS smart trainer (built around the Van Rysel / Decathlon D100). Optional separate power meter, heart-rate monitor, and cadence sensor.
- Planning happens in Cursor, Claude Desktop, or ChatGPT desktop, over MCP, against the same Local Store the UI uses. MCP does not connect to the trainer and does not need the ride to be in progress.
- macOS or Windows. From source, the Ride UI needs desktop Chrome or Edge. The desktop app is an Electron window around that same UI, for riders who do not want a terminal.
- Strava upload and a one-way Google Calendar mirror are optional. OpenTrainer stays the source of truth. Activities are not copied to Google Calendar. Edits made in Google are not imported.

## Capabilities and Constraints

Shipped:

- Ride a Scheduled Ride or a Free Ride on the trainer, with live power, ERG targets, and a recorded Activity.
- Devices for the trainer and optional sensors. History, Training Calendar, and Profile (FTP, Coggan power zones, Training Intent, mean maximal power).
- Local Companion owns a JSON Local Store. The browser UI and MCP both use it. Bluetooth stays in the window that shows the UI.
- MCP can read the rider profile and recent training, set FTP and Training Intent, and create or adjust Workouts and Scheduled Rides. It cannot invent an Activity or open a Bluetooth connection.
- FTP and Training Intent are written through MCP. The Profile tab shows them and does not edit them.
- An Activity exists only after a real ride. Manual FIT export is always available. Strava upload needs the rider’s own API app.
- Workouts are written for a week’s Scheduled Rides. There is no workout catalog to browse on the Ride tab.
- One rider, no account, no cloud sync. Personal rides and OAuth tokens stay on the machine and out of the repo.

Not in the product, and not implied by the loop: coach or multi-rider accounts, custom power zones, CTL/ATL, a stored weekly availability calendar, and a long-term periodization plan. Training Intent is a short durable brief. Week-to-week availability is asked in chat.

## Brand Commitments

- The product name is OpenTrainer. The local folder may still be named UntitledTrainer.
- MIT license, © 2026 Jan Petr.
- Public on GitHub so friends and riders in the same situation can run the same local setup.
- Shipping data is two anonymized sample workouts only.

## Evidence on Hand

- Domain language and shipped behavior are recorded in `CONTEXT.md`, `README.md`, and `docs/decisions/`.
- Sample workouts: `companion/data/workouts/sample-easy-endurance` and `sample-vo2-intervals`.
- No testimonials, customer logos, press, pricing page, or usage claims exist. Future work must not invent them.
- Real ride files, Strava tokens, and Google tokens are local and gitignored.

## Product Principles

1. The plan and the history stay on the rider’s machine, where the rider and their AI can both read them.
2. The AI may write the plan. An Activity exists only after the rider actually rides.
3. One rider, one machine. No account and no vendor cloud as the source of truth.
4. While a ride is in progress, live power and the workout are the job. Planning and review happen around that.
5. Strava and Google Calendar are optional copies outward. They never become the record OpenTrainer trusts.

## Accessibility & Inclusion

Live watts and the rest of the ride screen must stay readable from the bike under ordinary room light. No formal accessibility standard was chosen.
