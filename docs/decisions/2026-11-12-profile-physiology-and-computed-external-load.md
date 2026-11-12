---
date: 2026-11-12
status: active
supersedes: 2026-11-12-fitness-fatigue-form-and-blocker-external-load.md (Garmin TL 1:1 as primary External Load only)
---

# Profile physiology and computed External Load

## Context

Importing Garmin runs via ChatGPT with Training Load pasted 1:1 as External Load produced outliers (wrong field / non-TSS scale). The rider wants ChatGPT to pass **raw** session metrics; OpenTrainer should **compute** External Load. Bike FTP already lives on the Rider Profile; run load needs threshold anchors. UI already says Profile; glossary keeps **Rider Profile**.

## Decision

### Physiology on Rider Profile (UI: Profile)

- Keep **FTP** (watts).
- Add **LTHR** (`lthrBpm`).
- Add **Threshold Pace** as `runThresholdPaceSecPerKm` (seconds per km only; UI may show `m:ss/km`).
- One MCP physiology write tool (fold/`set_physiology`; `set_ftp` may remain a thin alias): omitted fields keep. Intent stays `set_training_intent`.

### External Load computation (companion)

ChatGPT passes raw session facts on complete/create (e.g. `averagePaceSecPerKm`, `averageHrBpm`, `durationMin`, `startsAt`, label). OpenTrainer computes `trainingStressScore`:

1. **rTSS** when avg pace + Threshold Pace exist (pace-first).
2. Else **hrTSS** when avg HR + LTHR exist.
3. Else duration × effort heuristic (`easy` / `steady` / `hard`).
4. Explicit `trainingStressScore` remains a rare manual override.

Provenance in the label (e.g. `· rTSS` / `· hrTSS` / `· duration est`). Garmin Training Load is **not** the primary score (supersedes the TL 1:1 primary rule).

## Alternatives considered

- **Keep TL→External Load in the prompt** — rejected after bad Oct 17 / Oct 31 imports.
- **LTHR-only or pace-only** — rejected; both anchors belong on Profile; pace-first when both session metrics exist.
- **Max(rTSS, hrTSS)** — rejected; double-counts one session.
- **Store pace as `4:53/km` strings** — rejected; seconds only in the store.
- **Separate set_lthr / set_run_threshold tools** — rejected; one physiology write with omit-to-keep.

## Consequences

- Profile tab shows LTHR + threshold pace (read-only) next to FTP.
- `complete_blocker` / create-completed grow raw metric fields; domain module owns rTSS/hrTSS.
- Prompts: pass Garmin pace/HR/duration; do not invent TSS; set physiology when null.
- Update [form + External Load](2026-11-12-fitness-fatigue-form-and-blocker-external-load.md) TL-primary clause as superseded for the compute path.
