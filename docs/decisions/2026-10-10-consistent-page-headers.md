---
date: 2026-10-10
status: active
---

# Consistent page headers

## Context

Tab headers disagreed: Ride used “OpenTrainer”, Calendar used “Training Calendar”,
blurbs lived in the header on Calendar but in the first panel elsewhere, and History
had a larger title scale.

## Decision

Shared `PageHeader` on every tab:

- **Title** matches the nav label: Ride · Devices · History · Calendar · Profile
- **Status** under the title: Ride → sensor strip; Devices → Bluetooth; History /
  Calendar / Profile → Local Companion
- **Blurb** (optional) one muted line under status, same placement when present
- One type scale for all page titles

## Alternatives considered

- **Title only** — rejected; status is useful chrome and would scatter into panels.
- **Brand (“OpenTrainer”) on every tab** — rejected; tab label is the clearer page identity.

## Consequences

- `web/src/PageHeader.tsx`; panels stop using ad-hoc `live-header` markup.
- Devices connector blurb moved into the page header (not duplicated under Connectors).
