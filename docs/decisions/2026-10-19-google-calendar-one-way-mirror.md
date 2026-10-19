---
date: 2026-10-19
status: active
supersedes: 2026-10-09-app-local-training-calendar.md (no-external-sync consequence only); 2026-10-09-slice5-training-calendar.md (external sync out of scope only)
---

# Google Calendar one-way mirror of Scheduled Rides

## Context

The rider wants the in-app calendar kept in step with their Gmail calendar. The **Training Calendar** is a view over **Scheduled Ride**s and **Activity**s, and v1 explicitly left Google/Apple sync out of scope.

## Decision

**Calendar Mirror**: OpenTrainer stays the source of truth. Each **Scheduled Ride** is copied onto Google Calendar as a native event via the Google Calendar API. The **Local Companion** owns the authorization (same shape as **Strava Link**: OAuth, tokens in the Local Store, client id and secret in `companion/.env`). Events go on a dedicated OpenTrainer calendar the app creates in the rider’s Google account, so the app only needs access to calendars it created. **Activity**s are not copied. The Google event uses the **Workout** name as its title, `startsAt` plus the workout duration as its time, and **Session Purpose** as the description when one is set. Lifecycle:

- Reschedule moves the event.
- Skip, delete, and clear remove the event. The skip remains in OpenTrainer.
- Complete leaves the event.
- A missed ride (still `planned`, `startsAt` in the past) stays until skip or delete.

A local Scheduled Ride write succeeds even when Google is unreachable. The mirror catches up later; Google is not a second source of truth. This is not two-way sync and not a read-only overlay of Gmail events on the Training Calendar.

On first connect, copy **planned** rides whose `startsAt` is from the start of the local day onward, including earlier today if still planned. Do not copy completed history or older missed rides. After that, each new Scheduled Ride is copied when it is created.

The companion is not always running — the rider starts it for a session (including from Cursor). Events already written to Google stay there after the process exits. Nothing is removed on shutdown. The mirror reconciles when the companion is running (startup plus each Scheduled Ride change). Changes made only while it is stopped show up in Google the next time it runs.

Unlink only drops the Google authorization on this laptop. The OpenTrainer calendar and its events stay in Google and stop updating until the rider connects again. Reconnect reuses that calendar when it still exists.

The rider does not move or edit these events in Google Calendar. OpenTrainer wins on reconcile: the companion puts each event back to the Scheduled Ride time, title, and description. A drag in Google does not reschedule the ride. If an event was deleted in Google, the next reconcile recreates it while the ride is still planned.

## Alternatives considered

- **Read-only overlay of Google events** — useful for seeing meetings while planning, but does not put rides on the Gmail calendar.
- **Two-way sync** — a reschedule in Gmail and a skip in the app disagree, and one side has to win. Deferred until the one-way mirror is solid.
- **Private iCal feed** — no Google Cloud project, but Google refreshes subscribed calendars on its own schedule (often many hours), so a newly planned ride may not show until the next day.
- **Primary Google calendar** — rides sit directly among meetings, but the app needs access to events on all calendars, and disconnect cannot separate rides from the rest of the account.
- **Keep skipped rides as cancelled Google events** — preserves the skip outside the app, and leaves a ghost on the day that should be free.
- **Backfill every planned ride, including old missed ones** — fills Google with days already not ridden.
- **Delete the OpenTrainer calendar on unlink** — removes the copy the rider looks at while the app is closed. Rejected. Quitting the app never deletes events either.
- **Import a Google drag as a reschedule** — rejected; the rider will not move these events in Google, and OpenTrainer stays the source of truth.
- **Connect control on the Calendar tab** — rejected; authorization sits with **Strava Link** on Profile.

## Consequences

- The Training Calendar remains an app-local view. Google Calendar is an outbound copy, not a second source of truth.
- Connect and unlink live on the Profile tab, next to **Strava Link**.
- Events are created with reminders off.
- The companion keeps a Google event id per **Scheduled Ride** so a delete can still be retried after the ride file is gone. If Google has dropped an event that is still planned, the next reconcile creates it again.
- UI and MCP **Scheduled Ride** writes reconcile while that process is running. Starting the HTTP companion or MCP reconciles once, which is the catch-up after the app was stopped.
- Requires a Google Cloud OAuth client before the mirror can be used, same kind of personal setup as Strava. Unlink keeps `calendarId` in the Local Store so the next connect reuses that calendar.
