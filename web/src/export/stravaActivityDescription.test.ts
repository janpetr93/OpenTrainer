import { describe, expect, it } from 'vitest'
import { stravaActivityDescription } from './stravaActivityDescription'

const load = {
  ftpWattsAtSave: 250,
  normalizedPowerWatts: 245,
  intensityFactor: 0.89,
  trainingStressScore: 78,
  timeInZonesSec: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
} as const

describe('stravaActivityDescription', () => {
  it('returns undefined when there is no Session Load and no planned structure', () => {
    expect(
      stravaActivityDescription({
        sessionLoad: null,
        plannedPowerProfile: null,
      }),
    ).toBeUndefined()
  })

  it('formats Session Load as NP · IF · TSS', () => {
    expect(
      stravaActivityDescription({
        sessionLoad: load,
        plannedPowerProfile: null,
      }),
    ).toBe('NP 245 · IF 0.89 · TSS 78')
  })

  it('omits Session Purpose and appends the planned step structure', () => {
    const activity = {
      purpose: 'Raise lactate threshold',
      sessionLoad: load,
      plannedPowerProfile: [
        { tSec: 0, watts: 100 },
        { tSec: 600, watts: 100 },
        { tSec: 600, watts: 150 },
        { tSec: 1800, watts: 150 },
      ],
    }
    expect(stravaActivityDescription(activity)).toBe(
      'NP 245 · IF 0.89 · TSS 78\n\n10m - 100W, 20m - 150W',
    )
  })

  it('formats sub-minute and mixed durations', () => {
    expect(
      stravaActivityDescription({
        sessionLoad: null,
        plannedPowerProfile: [
          { tSec: 0, watts: 240 },
          { tSec: 30, watts: 240 },
          { tSec: 30, watts: 100 },
          { tSec: 120, watts: 100 },
        ],
      }),
    ).toBe('30s - 240W, 1m 30s - 100W')
  })

  it('omits null Session Load metrics', () => {
    expect(
      stravaActivityDescription({
        sessionLoad: {
          ...load,
          normalizedPowerWatts: null,
          intensityFactor: null,
          trainingStressScore: 42,
        },
        plannedPowerProfile: null,
      }),
    ).toBe('TSS 42')
  })

  it('omits a planned profile that never resolved above 0 W', () => {
    expect(
      stravaActivityDescription({
        sessionLoad: null,
        plannedPowerProfile: [
          { tSec: 0, watts: 0 },
          { tSec: 600, watts: 0 },
        ],
      }),
    ).toBeUndefined()
  })
})
