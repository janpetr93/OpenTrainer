---
date: 2026-10-09
status: active
supersedes: 2026-10-09-slice4-fit-export.md (manual-only Strava consequence only)
---

# Strava Link + one-click Activity upload

## Context

Slice 4 ships indoor FIT export for **manual** Strava file upload. Rider wants both: keep manual download, and optional API upload after authorizing Strava. Strava Standard Tier API access requires a paid Strava subscription and a registered API application (`client_id` / `client_secret`). There is no app login in this product — only a local rider and Local Store.

## Decision

- Keep **Export FIT** (browser download) forever as the free / offline path.
- Add **Strava Link**: OAuth (`activity:write`) owned by the **Local Companion** — localhost callback on `127.0.0.1:8787`, refresh/access tokens in Local Store, never treat Strava as product identity.
- Upload is **one-click per completed Activity** (not auto-on-save). UI button next to Export FIT; companion performs `POST /api/v3/uploads` with the same indoor FIT we already encode.
- FIT bytes: reuse `encodeActivityFit` in the browser; UI posts the FIT (or activity id + encoded body) to a companion upload route that attaches the bearer token. Avoid porting the encoder until a second consumer needs it.
- Credentials: `STRAVA_CLIENT_ID` / `STRAVA_CLIENT_SECRET` in gitignored `companion/.env` (app secrets). OAuth tokens stay in Local Store (rider auth state).
- UI: connect/disconnect **Strava Link** on the Rider Profile area; upload controls on Workouts / Calendar activity rows. If credentials or link missing, upload explains what is needed; Export FIT still works.
- Re-upload: if an Activity already has a recorded Strava upload id, warn and allow explicit retry.
- MCP: Strava Link / upload remain out of MCP (same as prior MCP decisions).
- Prerequisite to use (not to code): rider Strava subscription + API app at [strava.com/settings/api](https://www.strava.com/settings/api); Authorization Callback Domain includes `localhost` / `127.0.0.1`.

## Alternatives considered

- **Manual FIT only** — still available; rejected as the *only* path once subscription is acceptable.
- **Browser PKCE + tokens in localStorage** — rejected; client secret and durable tokens belong in the companion.
- **Auto-upload on Activity save** — deferred; surprising and harder to reason about duplicates.
- **Companion re-encodes FIT from JSON** — deferred; reuse browser encoder for v1.
- **Credentials pasted in UI / stored in Local Store** — rejected for client secret; env file is enough for a personal laptop app.

## Consequences

- Supersedes the “Strava upload remains manual only” consequence of slice 4; manual path remains as fallback.
- Requires gitignore for `companion/.env` and a short companion README note on Strava setup.
- Glossary: **Strava Link** ≠ Bluetooth **Connection** (see CONTEXT.md).
- Cannot end-to-end test API upload without a subscribed Strava account and registered API app.
