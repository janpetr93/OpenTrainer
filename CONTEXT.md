# OpenTrainer

Local laptop app for indoor cycling: connects to a smart trainer over Bluetooth FTMS (built around the Van Rysel / Decathlon D100), shows live training metrics, runs power-target workouts, keeps an app-local training history, and exposes MCP for workouts/activities.

## Language

### Device & connection

**Trainer**:
The D100 smart trainer as a single Bluetooth FTMS device this app connects to.
_Avoid_: Bike, sensor (unless a separate HR/cadence device), machine

**Power Meter**:
A separate Bluetooth Cycling Power Service (CPS) device — in this app, the Favero Assioma Uno pedal — used only to compare against **Trainer** power, not to control resistance or own the recorded **Power Profile**.
_Avoid_: Trainer, sensor (generic), primary power source

**Heart Rate Monitor**:
A separate Bluetooth Heart Rate Service (`0x180D`) strap/device used for live bpm on the Ride tab — not written into **Activity** / FIT in this slice.
_Avoid_: Trainer HR (FTMS field), invented bpm

**Cadence Sensor**:
A separate Bluetooth Cycling Speed and Cadence (CSC, `0x1816`) device used for live rpm on the Ride tab; preferred over trainer-reported cadence when connected and fresh.
_Avoid_: Trainer cadence as the sensor itself

**Connection**:
The user-initiated Web Bluetooth link between the browser and the **Trainer**.
_Avoid_: Pairing (OS Bluetooth pairing), OS-level bond

**Power Meter Connection**:
The user-initiated Web Bluetooth link between the browser and the **Power Meter** (independent of the **Trainer** **Connection**).
_Avoid_: Pairing, dual Connection (ambiguous — name which device)

**FTMS**:
Bluetooth Fitness Machine Service used to discover capabilities, receive power, and (when supported) send control commands to the **Trainer**.

**CPS**:
Bluetooth Cycling Power Service (`0x1818`) used to receive instantaneous power from the **Power Meter**.
_Avoid_: FTMS, Indoor Bike Data

**Device Picker**:
The browser’s Web Bluetooth chooser — filtered per device: **FTMS** / **CPS** / Heart Rate / CSC (plus common name prefixes).
_Avoid_: Pairing dialog

**Known Devices**:
Bluetooth devices this origin may reconnect to without a new **Device Picker** — from `navigator.bluetooth.getDevices()`, shown in-page per role (not a live nearby scan).
_Avoid_: Advertising list, OS paired devices (unless also permitted for this origin)

**Connect All Known**:
One **Devices**-tab action that sequentially connects every role that has at least one **Known Device** and is not already connected; roles with none stay disconnected and are named in a short summary.
_Avoid_: Auto-connect on page load, parallel GATT storm

**Disconnect All**:
One **Devices**-tab action that disconnects **Trainer**, **Power Meter**, **Heart Rate Monitor**, and **Cadence Sensor** links.
_Avoid_: OS unpair, revoking browser permission

**Find New Device**:
Collapsed per-role escape hatch that opens the **Device Picker** (filtered or accept-all) when no suitable **Known Device** exists or the rider wants a different one.
_Avoid_: In-page BLE scan results

### Live ride

**Live Power**:
The current instantaneous power in watts reported by the **Trainer**, or a clear stale/missing state when notifications stop. Remains the primary live watts even when a **Power Meter** is connected.
_Avoid_: Average power, normalized power (those are later analytics), Meter Power

**Meter Power**:
The current instantaneous power in watts reported by the **Power Meter** (Assioma Uno estimated total from one pedal), or a clear stale/missing state.
_Avoid_: Live Power, primary watts

**Power Alignment**:
Live comparison of **Live Power** vs **Meter Power** (both values plus delta) so the rider can see how the **Trainer** and **Power Meter** agree — not a recorded metric and not used for ERG.
_Avoid_: Calibration offset (no auto-correction in this slice), dual Power Profile

**Stale Power**:
**Live Power** or **Meter Power** marked unusable because no power notification arrived within the freshness window (~2s).
_Avoid_: Zero watts, disconnected (connection may still be up)

**Devices** (tab):
The top-level tab for **Connection** / sensor links, **Known Devices**, **Connect All Known** / **Disconnect All**, and **Find New Device** — separate from the **Live Display** ride surface.
_Avoid_: Sensors tab (pills/status only), Settings, Pairing screen

**Live Display**:
The Ride-tab view of **Live Power** / **Meter Power** / **Power Alignment**, later confirmed FTMS fields (e.g. cadence/speed if present), ride plan / runner controls, and a thin sensor-status strip with a link that switches to the **Devices** tab (full connectors live only there — including mid-ride); when Start is blocked for no trainer, the same tab-switch affordance replaces “connect below” copy.
_Avoid_: Dashboard, analytics view, invented sensor values, full **Known Devices** list on Ride

**Connection State**:
One of: disconnected, connecting, connected, or disconnected-with-reconnect (link lost; samples/UI preserved for reconnect).

**Control Probe**:
An automatic post-connect FTMS check that Request Control and (if advertised) target-power commands are accepted, reported in the **Devices**-tab FTMS debug panel only.
_Avoid_: Workout, ERG mode UI, silent resistance changes without surfacing the result

### Persistence (from slice 2)

**Local Companion**:
A Node process on the laptop that owns persistence, serves the web app, exposes local HTTP for the UI, and speaks MCP — not a cloud backend.
_Avoid_: Server, backend-as-product, cloud sync

**Local Store**:
Versioned JSON files on disk (`workouts/`, `activities/`, later scheduled rides) owned by the **Local Companion**.
_Avoid_: localStorage as source of truth, remote database

### Plans & history (later slices)

**Workout**:
An interval plan (warm-up, steady target-power, recovery, cool-down) with durations and targets as watts and/or `%FTP` / **Power Zone** — usually created for a specific week’s **Scheduled Ride**s, not maintained as a long-lived reusable library.
_Avoid_: Session, activity, ride plan (ambiguous), workout catalog / template library (product framing)

**Target Prescription**:
How a **Workout** step expresses load: absolute watts, percent of **FTP**, and/or a **Power Zone** — resolved to watts using the current **Rider Profile** when riding or charting.
_Avoid_: Frozen-only watts (unless the step is absolute-watts-only)

**Scheduled Ride**:
A **Workout** placed on a calendar date/time for planned training, optionally with a **Session Purpose**, with status `planned` / `completed` / `skipped` (derived **missed** when still planned and `startsAt` is past).
_Avoid_: Session, event, booking

**Missed** (Scheduled Ride):
Derived view when a **Scheduled Ride** is still `planned` and its `startsAt` is in the past — not a stored status and not a fake **Activity**.
_Avoid_: Skipped (explicit rider/MCP action), deleted

**Session Purpose**:
Optional short free-text on a **Scheduled Ride** (copied onto the **Activity** when ridden) stating what the session is for — e.g. improve endurance or raise lactate threshold — not the rider-level **Training Intent**.
_Avoid_: Intent (use **Training Intent** for the profile goal), phase, availability

**Activity**:
The recorded outcome of an actual ride (timestamped power samples and interval metadata), exportable as an indoor trainer FIT file (TCX only if FIT proves painful); may carry **Session Purpose** copied from the **Scheduled Ride**, plus **Session Load** and optional **Session Adherence**.
_Avoid_: Session, workout (a **Workout** is the plan; an **Activity** is what was ridden)

**Power Profile**:
Watts over elapsed time for a plan or ride — for a **Workout**, the planned step chart; for an **Activity**, achieved power (and planned overlay when a **Workout** was followed). Achieved points may also include optional `hrBpm` / `cadenceRpm` / `meterWatts` when those sensors were fresh; the Ride chart overlays these metrics (watts series share a scale with optional **Power Zone** bands from **FTP**; HR/cadence scale independently).
_Avoid_: Power curve (use **Mean Maximal Power** for bests), MMP as a synonym for this session chart

**Session Load**:
Coggan Normalized Power, Intensity Factor, Training Stress Score, and time-in-zone seconds on an **Activity**, computed at save from the achieved **Power Profile** and **FTP** (FTP snapshotted as `ftpWattsAtSave`); null when FTP is unset; NP/IF/TSS null when fewer than 30 samples.
_Avoid_: CTL/ATL/TSB (deferred), live mid-ride TSS

**Session Adherence**:
How closely an **Activity** followed its planned **Power Profile**: completion ratio and target-adherence fraction within `|Δ| ≤ max(15% × planned, 20W)`; null for a **Free Ride**.
_Avoid_: Compliance score (synonym — use this term), TSS

**Mean Maximal Power** (MMP):
Lifetime best average trainer watts for fixed durations (5s–90min) across all **Activity** achieved **Power Profile**s — cached in the **Local Store**, shown on the Profile tab, recomputed automatically when an **Activity** is saved (manual Recompute remains); distinct from a session **Power Profile**.
_Avoid_: Power Profile, power curve alone (ambiguous), meter-watts bests

**Estimated FTP**:
FTP implied by **MMP** as 20min MMP × 0.95, compared to the set **FTP** on the **Rider Profile** — never auto-written back to the profile.
_Avoid_: Set FTP, threshold test protocol

**Workout Specs**:
The create/list payload for a **Workout**: name, ordered steps (type, duration, target watts), and its planned **Power Profile**.

**Activity Specs**:
The summary payload for an **Activity**: start time, duration, average/max power, achieved **Power Profile**, planned **Power Profile** when the ride followed a **Workout**, plus **Session Load** / **Session Adherence** when computed.
_Avoid_: Invented HR/cadence

**Free Ride**:
An **Activity** recorded without starting from a **Workout** or **Scheduled Ride** — achieved **Power Profile** only, no planned overlay.

**Training Calendar**:
The app-local calendar view of upcoming **Scheduled Ride**s and past **Activity**s (no external calendar sync in v1).
_Avoid_: Google Calendar, schedule (noun for the whole product)

### Rider prescription

**FTP**:
The rider’s functional threshold power in watts, stored in the **Rider Profile** and used to derive **Power Zones**.
_Avoid_: Threshold (ambiguous), FTP% as the profile itself

**Power Zones**:
Seven Coggan training zones (Z1–Z7) computed from **FTP** as percent-of-FTP bands; not manually edited in v1.
_Avoid_: Custom zones (deferred), heart-rate zones

**Rider Profile**:
Local Store record of the rider’s **FTP** (and derived **Power Zones**) plus optional **Training Intent**; UI reads it; MCP is the write path for FTP/Intent. The Profile tab also shows **Mean Maximal Power** (separate cache file).
_Avoid_: Account, user settings (cloud)

**Training Intent**:
Durable brief on the **Rider Profile** for week planning: the rider’s training **goal**, optional free-text **horizon** / **note**, and optional planning constraints (`maxHardDaysPerWeek`, `preferredLongRideWeekday` 0=Sun–6=Sat, `constraintsNote`); not a multi-week calendar and not chat memory as source of truth.
_Avoid_: Phase (derived from **Activity** history unless noted), availability (ask in chat), periodization plan, long-term plan (ambiguous), structured targetDate (deferred)

### External export

**Strava Link**:
Optional OAuth authorization between this laptop’s **Local Companion** and the rider’s Strava athlete account, used only to upload **Activity** FIT files; not app login and not a Bluetooth **Connection**.
_Avoid_: Connection (BLE), Account, Strava login (as product identity)

## Relationships

- A **Connection** is to exactly one **Trainer** at a time; **Power Meter**, **Heart Rate Monitor**, and **Cadence Sensor** links are independent optional Web Bluetooth connections.
- Live HR/cadence from dedicated sensors are recorded onto achieved **Power Profile** samples when fresh, then available via Local Store / MCP / FIT.
- **Live Power** is fresh only while a **Connection** is delivering FTMS power notifications; otherwise the **Live Display** shows **Stale Power** or “no power data.”
- **Meter Power** does not replace **Live Power** for ERG, workout targets, or the achieved **Power Profile**.
- **Power Alignment** is live-only comparison; it does not rewrite trainer watts.
- The **Device Picker** is how a **Connection** or **Power Meter Connection** begins (separate chooser filters).
- A successful **Connection** triggers a **Control Probe**; the main **Live Display** still only shows power/connection, not workout controls.
- A **Scheduled Ride** references exactly one **Workout** and may carry a **Session Purpose**.
- Riding a **Workout** via a **Scheduled Ride** (Ride panel / Calendar) produces one **Activity** linked by `scheduledRideId` and marks the ride `completed`; unstructured riding is a **Free Ride** (no workout-catalog picker on Ride).
- A **Scheduled Ride** may be explicitly `skipped` (optional reason) or rescheduled; past `planned` rides appear as **missed** in list/MCP views.
- A past **Activity** that followed a **Workout** can be placed again via **Schedule again** (new **Scheduled Ride** on a chosen date, purpose copied when present).
- **Session Purpose** is not **Training Intent**; Intent is durable rider direction, Purpose is per-session coaching rationale.
- MCP never opens a **Connection** or invents an **Activity**; v2 adds profile + calendar tools for week planning.
- A **Workout** always has a planned **Power Profile** (resolved from **Target Prescription** + current **FTP** when charted/ridden).
- A **Scheduled Ride** on the **Training Calendar** day detail and Ride panel shows that **Workout**’s duration and planned **Power Profile** (current **FTP**; `%FTP`/zone plans need FTP set to preview).
- A **Free Ride** is an **Activity** with no planned **Power Profile**.
- The **Training Calendar** shows **Scheduled Ride**s (future) and **Activity**s (past).
- The **Local Companion** owns the **Local Store**; the browser UI and MCP both read through it; **FTP** / **Training Intent** writes are MCP-only (UI remains read-only for those fields).
- **Connection** / Web Bluetooth stay in the browser, not in the **Local Companion**.
- **Power Zones** are derived from **FTP** on the **Rider Profile** (Coggan 7-zone defaults).
- **Mean Maximal Power** is computed from all **Activity** achieved **Power Profile**s (trainer watts), persisted separately from the **Rider Profile**, and marked stale when Activities change until the rider recomputes.
- **Estimated FTP** uses 20min **MMP** × 0.95 and is compared to set **FTP**; it does not update the **Rider Profile**.
- **Session Load** and **Session Adherence** are computed when an **Activity** is saved (and backfilled for older Activities when FTP is known); MCP `list_activities` and the Session module UI read them.
- **Training Intent** is product-owned context for MCP week planning alongside **Rider Profile** and **Activity** history; weekly availability is asked in chat, not stored; training phase is inferred from recent **Activity**s unless **Training Intent** **note** overrides.
- An **Activity** can be exported as FIT for manual Strava upload and/or uploaded via API when a **Strava Link** exists.
- The **Local Companion** owns the **Strava Link** (tokens + upload); the browser never holds the Strava client secret.
- MCP does not create or use a **Strava Link** (UI + companion HTTP only).

## Example dialogue

> **Dev:** "For the first slice, is a **Connection** enough, or do we need a full workout?"
> **Rider:** "Just connect and show **Live Power**. If watts update on the **Live Display**, the **Trainer** link works."
>
> **Dev:** "Should the **Control Probe** change the trainer load?"
> **Rider:** "Only a brief safe target in debug — don't build workout controls yet, but do tell me if ERG worked."
>
> **Dev:** "When you say MCP should create a session, is that a **Workout**, a **Scheduled Ride**, or an **Activity**?"
> **Rider:** "**Workout** and/or **Scheduled Ride**. An **Activity** only exists after I actually ride."
>
> **Dev:** "By power curve on a ride, do you mean mean-maximal bests or the session **Power Profile**?"
> **Rider:** "On the ride chart, **Power Profile**. Lifetime bests live on Profile as **Mean Maximal Power**."
>
> **Dev:** "How does **MMP** relate to my set **FTP**?"
> **Rider:** "Show **Estimated FTP** from 20min MMP × 0.95 next to the set value — don’t overwrite FTP."
>
> **Dev:** "What if I just spin with no plan?"
> **Rider:** "That's a **Free Ride** — still an **Activity**, but no planned overlay."
>
> **Dev:** "Where do MCP and the UI both see **Workout**s?"
> **Rider:** "In the **Local Store**, owned by the **Local Companion** — not in the browser alone."
>
> **Dev:** "If **FTP** changes after a plan is written, do we keep old watts?"
> **Rider:** "Keep the **Target Prescription**; resolve watts from current **FTP** when I ride."
>
> **Dev:** "Is connecting Strava the same as a **Connection**?"
> **Rider:** "No — **Connection** is Bluetooth to the **Trainer**. **Strava Link** is OAuth so I can one-click upload an **Activity**."
>
> **Dev:** "Should the long-term plan live only in ChatGPT history?"
> **Rider:** "No — keep a thin **Training Intent** in the **Local Store**. Infer recent phase from **Activity**s; ask availability in chat when planning the week."
>
> **Dev:** "When MCP schedules Tuesday’s ride, where does ‘raise lactate threshold’ go?"
> **Rider:** "That’s **Session Purpose** on the **Scheduled Ride** — not **Training Intent**. Copy it onto the **Activity** when I finish."

## Code map

| Term | Where |
| --- | --- |
| **Connection** / FTMS | `web/src/ftms/trainerConnection.ts` (+ parsers under `web/src/ftms/`) |
| **Power Meter Connection** / CPS | `web/src/cps/powerMeterConnection.ts` (+ `parseCyclingPowerMeasurement`, `powerAlignment`) |
| **Heart Rate Monitor** | `web/src/hrm/heartRateConnection.ts` |
| **Cadence Sensor** | `web/src/csc/cadenceConnection.ts` |
| Shared notify sensors | `web/src/ble/notifySensorConnection.ts` |
| **Power Alignment** | `web/src/cps/powerAlignment.ts` + Ride tab in `LiveDisplay` |
| **Live Display** | `web/src/LiveDisplay.tsx` |
| **Known Devices** / **Connect All Known** / **Disconnect All** | `web/src/ble/connectAllKnown.ts` + **Devices** tab UI (see `docs/decisions/2026-10-09-friendlier-connectors-known-devices.md`) |
| **Control Probe** | `web/src/ftms/controlProbe.ts` + probe runner in `trainerConnection.ts` |
| **Live Power** / **Stale Power** | `web/src/ftms/livePowerFreshness.ts` |
| **Activity** export | `web/src/export/encodeActivityFit.ts` — indoor FIT (manual download + Strava upload payload) |
| **Strava Link** | `companion/src/strava/`; routes `/api/strava/*`; UI Profile tab (`ProfilePanel`) + `ActivityActions` |
| **Workout** | `companion/src/store/localStore.ts`; started via **Scheduled Ride** / Schedule again (not a UI catalog) |
| **Devices** (tab) | `web/src/DevicesPanel.tsx` — connectors, **Known Devices**, **Connect All Known** / **Disconnect All**, FTMS debug; nav `APP_TAB_ORDER` in `web/src/appTab.ts` |
| **History** (tab) | `web/src/WorkoutsPanel.tsx` — **Activity** history + Schedule again |
| **Profile** (tab) | `web/src/ProfilePanel.tsx` — read-only **Rider Profile** (FTP / zones / Intent) + **MMP** + **Strava Link** |
| **Mean Maximal Power** | `companion/src/domain/meanMaximalPower.ts`; cache `companion/data/mmp.json`; GET/POST `/api/mmp`; MCP `get_mmp`; UI Profile tab |
| **Estimated FTP** | Derived in MMP enrich (20min × 0.95) vs set FTP on Profile / `get_mmp` |
| **Schedule again** | `web/src/ScheduleAgain.tsx` via `ActivityActions` |
| **Scheduled Ride** / **missed** | `companion/data/scheduled/`; API `/api/scheduled-rides` (+ `/skip`, `/reschedule`); MCP `skip_scheduled_ride` / `reschedule_scheduled_ride`; today's list in Ride panel (`LiveDisplay`); shared row UI `SessionModule` |
| **Session Purpose** | `purpose` on **Scheduled Ride** / **Activity**; MCP `create_scheduled_ride`; Calendar + History UI (see `docs/decisions/2026-10-10-session-purpose-on-scheduled-ride.md`) |
| **Training Calendar** | `web/src/CalendarPanel.tsx` |
| Session module (Scheduled / Activity rows) | `web/src/SessionModule.tsx` + `web/src/session/sessionModuleHelpers.ts` (`activityMeta` / `scheduledMeta`); planned preview via `web/src/domain/scheduledWorkoutPreview.ts` (Ride, History, Calendar) |
| **Activity** recording | `web/src/workout/` + `POST /api/activities`; runner on Ride tab |
| **Session Load** / **Session Adherence** | `companion/src/domain/sessionLoad.ts`, `sessionAdherence.ts`; on **Activity** JSON; Session module via `web/src/session/sessionModuleHelpers.ts` |
| **Workout** runner | `web/src/workout/workoutRunner.ts` — start/pause/resume/skip/stop + ERG targets |
| MCP | `companion/src/mcp/server.ts` — week-planning (`get_rider_profile`, `get_mmp`, `set_ftp`, `set_training_intent`, workouts, calendar, `clear_scheduled_rides`) |
| **Rider Profile** | `companion/data/profile.json`; GET `/api/profile`; UI Profile tab (read-only); MCP `set_ftp` / `get_rider_profile`; resolve `web/src/domain/resolveTarget.ts` |
| **Training Intent** | On **Rider Profile** / `profile.json`; UI Profile tab (read-only); MCP `set_training_intent` (see `docs/decisions/2026-10-10-training-intent-not-chat-only.md`, `docs/decisions/2026-10-10-mcp-writes-rider-profile.md`) |
| **Target Prescription** | Workout steps: watts / `%FTP` / zone; resolve at run via current FTP |
| **Local Companion** / **Local Store** | `companion/` + `companion/data/` — [ADR 0001](docs/adr/0001-local-companion-json-store.md) |

## Flagged ambiguities

- "intent" on a planned ride — resolved as **Session Purpose** (`purpose`); **Training Intent** stays on the **Rider Profile**.
- "Session" — resolved: do not use; say **Workout**, **Scheduled Ride**, or **Activity**.
- "Power curve" — session chart is **Power Profile**; lifetime bests are **Mean Maximal Power** (Profile).
- **Free Ride** — resolved: allowed; planned **Power Profile** omitted.
- **Training Calendar** — resolved: app-local; future Scheduled Rides + past Activities.
- Build order — resolved: slice1 Bluetooth proof → slice2 local store+MCP → slice3 runner/recording → slice4 export/Power Profile UI → slice5 Training Calendar.
- **Local Companion** + JSON **Local Store** — resolved in [ADR 0001](docs/adr/0001-local-companion-json-store.md).
- Export format — resolved: FIT first.
- Richer live metrics — resolved: discover via FTMS debug on hardware, then promote; never invent.
- **FTP** / **Power Zones** — resolved: FTP-only input; Coggan Z1–Z7 derived (no custom % yet).
- **Target Prescription** resolve timing — resolved: keep prescription; resolve watts at run/display from current FTP.
- MCP v2 week-planning tools — resolved (see `docs/decisions/2026-10-09-mcp-v2-week-planning.md`).
- Long-term plan / **Training Intent** — resolved: Local Store goal + optional horizon/note; not chat-only; no stored phase or availability (see `docs/decisions/2026-10-10-training-intent-not-chat-only.md`).
- **Rider Profile** writes — resolved: MCP-only for FTP/Intent; Profile tab read-only; no HTTP PUTs (see `docs/decisions/2026-10-10-mcp-writes-rider-profile.md`).
- Strava — resolved: keep manual FIT; add optional **Strava Link** + one-click upload (see `docs/decisions/2026-10-09-strava-link-and-upload.md`).
- **Power Meter** — resolved: Assioma Uno via CPS; comparison-only / live **Power Alignment**; trainer stays primary (see `docs/decisions/2026-10-09-power-meter-comparison-only.md`).
- **Heart Rate Monitor** / **Cadence Sensor** — resolved: live connectors + optional fields on achieved **Power Profile** (see `docs/decisions/2026-10-09-hrm-and-cadence-connectors.md`).
- Friendlier connectors — resolved: in-page **Known Devices**, explicit **Connect All Known** / **Disconnect All**, collapsed **Find New Device** (see `docs/decisions/2026-10-09-friendlier-connectors-known-devices.md`).
- **Devices** tab — resolved: top-level tab owns full connectors + FTMS debug; Ride keeps sensor-status strip + tab-switch link only; nav order Ride · Devices · History · Calendar · Profile.
- **Scheduled Ride** plan preview — resolved: duration + planned **Power Profile** on Calendar day detail and Ride (rebuild with current FTP; FTP gate for `%FTP`/zones; no zone bands) — see `docs/decisions/2026-10-10-scheduled-ride-plan-preview.md`.
- Session module UI — resolved: one row chrome for **Scheduled Ride** and **Activity** on Ride / History / Calendar; Activity adds achieved vs planned — see `docs/decisions/2026-10-10-unified-session-module-ui.md`.
