import { describe, expect, it } from 'vitest'
import {
  MMP_DURATIONS_SEC,
  computeMmpFromActivities,
  estimatedFtpFromMmp,
  mmpFingerprint,
} from './meanMaximalPower.js'
import type { Activity, PowerProfilePoint } from './types.js'

function profile(watts: number[]): PowerProfilePoint[] {
  return watts.map((w, tSec) => ({ tSec, watts: w }))
}

function activity(
  id: string,
  watts: number[],
  startedAt = '2026-01-01T10:00:00.000Z',
): Activity {
  return {
    schemaVersion: 1,
    id,
    startedAt,
    durationSec: Math.max(0, watts.length - 1),
    averagePowerWatts: null,
    maxPowerWatts: null,
    achievedPowerProfile: profile(watts),
    plannedPowerProfile: null,
    workoutId: null,
    scheduledRideId: null,
    purpose: null,
    sessionLoad: null,
    sessionAdherence: null,
    averageAlignmentDeltaWatts: null,
    createdAt: startedAt,
  }
}

describe('computeMmpFromActivities', () => {
  it('finds max average for a short contiguous window', () => {
    // 100 for 5s, then spike 200 for 5s
    const watts = [100, 100, 100, 100, 100, 200, 200, 200, 200, 200]
    const result = computeMmpFromActivities([activity('a1', watts)])
    expect(result.points.find((p) => p.durationSec === 5)?.watts).toBe(200)
    expect(result.points.find((p) => p.durationSec === 10)?.watts).toBe(150)
  })

  it('does not span gaps in the Power Profile', () => {
    const points: PowerProfilePoint[] = [
      ...[0, 1, 2, 3, 4].map((tSec) => ({ tSec, watts: 300 })),
      // gap — skip tSec 5–9
      ...[10, 11, 12, 13, 14].map((tSec) => ({ tSec, watts: 300 })),
    ]
    const act: Activity = {
      ...activity('gap', []),
      achievedPowerProfile: points,
      durationSec: 14,
    }
    const result = computeMmpFromActivities([act])
    expect(result.points.find((p) => p.durationSec === 5)?.watts).toBe(300)
    expect(result.points.find((p) => p.durationSec === 10)?.watts).toBeNull()
  })

  it('takes the max across Activities and records the source', () => {
    const weak = activity('weak', Array(30).fill(100), '2026-01-01T08:00:00.000Z')
    const strong = activity(
      'strong',
      Array(30).fill(250),
      '2026-01-02T08:00:00.000Z',
    )
    const result = computeMmpFromActivities([weak, strong])
    const p30 = result.points.find((p) => p.durationSec === 30)
    expect(p30?.watts).toBe(250)
    expect(p30?.activityId).toBe('strong')
    expect(p30?.startedAt).toBe('2026-01-02T08:00:00.000Z')
  })

  it('leaves long durations null when no Activity is long enough', () => {
    const result = computeMmpFromActivities([
      activity('short', Array(20).fill(200)),
    ])
    expect(result.points.find((p) => p.durationSec === 60)?.watts).toBeNull()
    expect(result.points.find((p) => p.durationSec === 5400)?.watts).toBeNull()
  })

  it('includes all canonical durations and a fingerprint', () => {
    const result = computeMmpFromActivities([activity('a', Array(5).fill(100))])
    expect(result.points.map((p) => p.durationSec)).toEqual([...MMP_DURATIONS_SEC])
    expect(result.fingerprint).toEqual({
      activityCount: 1,
      latestActivityId: 'a',
      latestCreatedAt: '2026-01-01T10:00:00.000Z',
    })
  })

  it('prefers Power Meter watts over Trainer when meterWatts is present', () => {
    const points: PowerProfilePoint[] = Array.from({ length: 5 }, (_, tSec) => ({
      tSec,
      watts: 200,
      meterWatts: 150,
    }))
    const act: Activity = {
      ...activity('metered', []),
      achievedPowerProfile: points,
      durationSec: 4,
    }
    const result = computeMmpFromActivities([act])
    expect(result.points.find((p) => p.durationSec === 5)?.watts).toBe(150)
  })

  it('falls back to Trainer watts when meterWatts is absent', () => {
    const points: PowerProfilePoint[] = Array.from({ length: 5 }, (_, tSec) => ({
      tSec,
      watts: 200,
    }))
    const act: Activity = {
      ...activity('trainer-only', []),
      achievedPowerProfile: points,
      durationSec: 4,
    }
    const result = computeMmpFromActivities([act])
    expect(result.points.find((p) => p.durationSec === 5)?.watts).toBe(200)
  })

  it('uses primary watts in meter-primary (already Meter Power)', () => {
    const points: PowerProfilePoint[] = Array.from({ length: 5 }, (_, tSec) => ({
      tSec,
      watts: 140,
      trainerWatts: 165,
    }))
    const act: Activity = {
      ...activity('meter-primary', []),
      achievedPowerProfile: points,
      durationSec: 4,
    }
    const result = computeMmpFromActivities([act])
    expect(result.points.find((p) => p.durationSec === 5)?.watts).toBe(140)
  })
})

describe('estimatedFtpFromMmp', () => {
  it('uses 20min MMP × 0.95', () => {
    const points = MMP_DURATIONS_SEC.map((durationSec) => ({
      durationSec,
      watts: durationSec === 1200 ? 300 : null,
      activityId: durationSec === 1200 ? 'a' : null,
      startedAt: durationSec === 1200 ? '2026-01-01T10:00:00.000Z' : null,
    }))
    expect(estimatedFtpFromMmp(points)).toBe(285)
  })

  it('returns null without a 20min best', () => {
    const points = MMP_DURATIONS_SEC.map((durationSec) => ({
      durationSec,
      watts: null,
      activityId: null,
      startedAt: null,
    }))
    expect(estimatedFtpFromMmp(points)).toBeNull()
  })
})

describe('mmpFingerprint', () => {
  it('tracks count and latest created Activity', () => {
    const a = activity('a', [1], '2026-01-01T00:00:00.000Z')
    const b = {
      ...activity('b', [1], '2026-01-02T00:00:00.000Z'),
      createdAt: '2026-01-03T00:00:00.000Z',
    }
    expect(mmpFingerprint([a, b])).toEqual({
      activityCount: 2,
      latestActivityId: 'b',
      latestCreatedAt: '2026-01-03T00:00:00.000Z',
    })
  })
})
