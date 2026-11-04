---
date: 2026-11-04
status: active
---

# OAuth return reloads the desktop window only once, after state is checked

## Context

The desktop return page at `/desktop/oauth-return` called back into the Electron window on every request. That `loadURL` fires `pagehide`, which disconnects the trainer and drops an Activity that has not been saved yet. Any local request could do it: a refresh of the sign-in tab, or another program on the machine. The companion already refuses a callback whose `state` was not issued by `beginAuthorize`, but the return page did not use that check.

## Decision

- After the OAuth `state` is accepted, Strava Link and Calendar Mirror may stamp the return URL with a one-time `handoff` token. The desktop server is the only caller that supplies the stamp. The dev companion leaves the return URL unchanged.
- `/desktop/oauth-return` still shows the "go back to the app" page for every visit. It reloads the app window only when the token matches one the server just issued, and only the first time.
- A running or paused ride is not reloaded. The filtered result (`strava`, `googleCalendar`, `message`) is stored for the Profile tab, which reads it once when the rider opens Profile.

## Alternatives considered

- **Arm a latch when sign-in starts** — a page can still open `/api/strava/callback?error=…` as a top-level navigation while the latch is open and force a reload.
- **Reload on every return, and stop disconnecting on `pagehide`** — an unsolicited hit would still navigate away from the ride.
- **Hand off only `linked` results** — a denied consent is a real result the Profile tab already shows, and the trust boundary is the checked `state`, which covers that error too.

## Consequences

- A forged or repeated return URL does not reload the window or discard the ride.
- Finishing sign-in during a ride leaves the trainer connected. The Profile banner appears when that tab is opened, not by replacing the ride page.
- `handoff` is not one of the query keys the web UI reads. The dev server's `/?strava=linked` URLs stay as they were.
