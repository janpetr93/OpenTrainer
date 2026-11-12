import { describe, expect, it } from 'vitest'
import type { PowerProfilePoint } from '../api'
import { stravaActivityDescription } from './stravaActivityDescription'

function plannedSteps(
  segments: readonly { durationSec: number; watts: number }[],
): PowerProfilePoint[] {
  const points: PowerProfilePoint[] = []
  let tSec = 0
  for (const segment of segments) {
    points.push({ tSec, watts: segment.watts })
    tSec += segment.durationSec
    points.push({ tSec, watts: segment.watts })
  }
  return points
}

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
      'NP 245 · IF 0.89 · TSS 78\n\n10m - 100W\n20m - 150W',
    )
  })

  it('notes the Ride Intensity under the planned steps', () => {
    const activity = {
      sessionLoad: load,
      sessionAdherence: {
        completionRatio: 1,
        targetAdherence: 0.95,
        intensityPercent: 80,
      },
      plannedPowerProfile: [
        { tSec: 0, watts: 280 },
        { tSec: 600, watts: 280 },
      ],
    }
    expect(stravaActivityDescription(activity)).toBe(
      'NP 245 · IF 0.89 · TSS 78\n\n10m - 280W\nRidden at 80% of plan',
    )
  })

  it('says nothing about intensity at 100%', () => {
    const activity = {
      sessionLoad: null,
      sessionAdherence: {
        completionRatio: 1,
        targetAdherence: 0.95,
        intensityPercent: 100,
      },
      plannedPowerProfile: [
        { tSec: 0, watts: 280 },
        { tSec: 600, watts: 280 },
      ],
    }
    expect(stravaActivityDescription(activity)).toBe('10m - 280W')
  })

  it('groups a repeated cycle onto one line and leaves the warm-up written out', () => {
    expect(
      stravaActivityDescription({
        sessionLoad: null,
        plannedPowerProfile: plannedSteps([
          { durationSec: 300, watts: 100 },
          { durationSec: 300, watts: 130 },
          { durationSec: 180, watts: 160 },
          { durationSec: 15, watts: 240 },
          { durationSec: 60, watts: 100 },
          { durationSec: 15, watts: 240 },
          { durationSec: 60, watts: 100 },
          { durationSec: 15, watts: 240 },
          { durationSec: 60, watts: 100 },
          { durationSec: 360, watts: 190 },
          { durationSec: 180, watts: 100 },
          { durationSec: 360, watts: 190 },
          { durationSec: 180, watts: 100 },
          { durationSec: 360, watts: 190 },
          { durationSec: 180, watts: 100 },
          { durationSec: 360, watts: 190 },
          { durationSec: 180, watts: 100 },
          { durationSec: 360, watts: 190 },
          { durationSec: 180, watts: 100 },
          { durationSec: 300, watts: 90 },
        ]),
      }),
    ).toBe(
      [
        '5m - 100W',
        '5m - 130W',
        '3m - 160W',
        '3x (15s - 240W, 1m - 100W)',
        '5x (6m - 190W, 3m - 100W)',
        '5m - 90W',
      ].join('\n'),
    )
  })

  it('leaves a partial cycle outside the group', () => {
    expect(
      stravaActivityDescription({
        sessionLoad: null,
        plannedPowerProfile: plannedSteps([
          { durationSec: 360, watts: 190 },
          { durationSec: 180, watts: 100 },
          { durationSec: 360, watts: 190 },
          { durationSec: 180, watts: 100 },
          { durationSec: 360, watts: 190 },
        ]),
      }),
    ).toBe('2x (6m - 190W, 3m - 100W)\n6m - 190W')
  })

  it('writes the shorter cycle when a longer one covers the same steps', () => {
    expect(
      stravaActivityDescription({
        sessionLoad: null,
        plannedPowerProfile: plannedSteps([
          { durationSec: 360, watts: 190 },
          { durationSec: 180, watts: 100 },
          { durationSec: 360, watts: 190 },
          { durationSec: 180, watts: 100 },
          { durationSec: 360, watts: 190 },
          { durationSec: 180, watts: 100 },
          { durationSec: 360, watts: 190 },
          { durationSec: 180, watts: 100 },
        ]),
      }),
    ).toBe('4x (6m - 190W, 3m - 100W)')
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
    ).toBe('30s - 240W\n1m 30s - 100W')
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

  it('writes an Open Step as open instead of 0 W', () => {
    expect(
      stravaActivityDescription({
        sessionLoad: null,
        plannedPowerProfile: [
          { tSec: 0, watts: 120 },
          { tSec: 300, watts: 120 },
          { tSec: 300, watts: null },
          { tSec: 1500, watts: null },
          { tSec: 1500, watts: 80 },
          { tSec: 1800, watts: 80 },
        ],
      }),
    ).toBe('5m - 120W\n20m - open\n5m - 80W')
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

  it('adds the Free Ride minutes ridden after the Workout', () => {
    expect(
      stravaActivityDescription({
        sessionLoad: load,
        plannedPowerProfile: plannedSteps([{ durationSec: 3600, watts: 160 }]),
        freeRideFromSec: 3600,
        durationSec: 3600 + 25 * 60 + 10,
      }),
    ).toBe('NP 245 · IF 0.89 · TSS 78\n\n60m - 160W\n+ 25 min free ride')
  })

  it('skips the Free Ride line under a minute', () => {
    expect(
      stravaActivityDescription({
        sessionLoad: null,
        plannedPowerProfile: plannedSteps([{ durationSec: 600, watts: 160 }]),
        freeRideFromSec: 600,
        durationSec: 625,
      }),
    ).toBe('10m - 160W')
  })
})
