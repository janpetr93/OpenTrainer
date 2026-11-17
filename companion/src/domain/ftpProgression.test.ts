import { describe, expect, it } from 'vitest'
import { localDateKey } from './blocker.js'
import { buildFtpProgression } from './ftpProgression.js'
import type { Activity, PowerProfilePoint, SessionLoad } from './types.js'

function profile(watts: number[]): PowerProfilePoint[] {
  return watts.map((w, tSec) => ({ tSec, watts: w }))
}

function activity(
  id: string,
  watts: number[],
  startedAt: string,
  ftpWattsAtSave: number | null = null,
): Activity {
  const sessionLoad: SessionLoad | null =
    ftpWattsAtSave === null
      ? null
      : {
          ftpWattsAtSave,
          normalizedPowerWatts: null,
          intensityFactor: null,
          trainingStressScore: null,
          timeInZonesSec: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
        }
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
    sessionLoad,
    sessionAdherence: null,
    averageAlignmentDeltaWatts: null,
    createdAt: startedAt,
  }
}

function steady(watts: number, n = 1200): number[] {
  return Array.from({ length: n }, () => watts)
}

describe('buildFtpProgression', () => {
  it('steps Estimated FTP only when a new 20-minute best is set', () => {
    const now = new Date('2026-04-01T12:00:00.000Z')
    const first = '2026-01-15T12:00:00.000Z'
    const easier = '2026-02-15T12:00:00.000Z'
    const tooShort = '2026-02-20T12:00:00.000Z'
    const better = '2026-03-15T12:00:00.000Z'
    const result = buildFtpProgression({
      activities: [
        activity('a', steady(200), first),
        activity('b', steady(180), easier),
        activity('short', steady(400, 60), tooShort),
        activity('c', steady(220), better),
      ],
      ftpHistory: [],
      currentFtpWatts: null,
      now,
    })
    expect(result.through).toBe(localDateKey(now.toISOString()))
    expect(result.points).toEqual([
      {
        date: localDateKey(first),
        setFtpWatts: null,
        estimatedFtpWatts: 190,
      },
      {
        date: localDateKey(better),
        setFtpWatts: null,
        estimatedFtpWatts: 209,
      },
    ])
  })

  it('holds set FTP until a clear, and repeats it when only Estimated FTP steps', () => {
    const now = new Date('2026-06-01T12:00:00.000Z')
    const setAt = '2026-01-10T12:00:00.000Z'
    const bestAt = '2026-03-01T12:00:00.000Z'
    const clearedAt = '2026-04-01T12:00:00.000Z'
    const result = buildFtpProgression({
      activities: [activity('a', steady(200), bestAt, 240)],
      ftpHistory: [
        { setAt, ftpWatts: 240 },
        { setAt: clearedAt, ftpWatts: null },
      ],
      currentFtpWatts: null,
      now,
    })
    expect(result.points).toEqual([
      {
        date: localDateKey(setAt),
        setFtpWatts: 240,
        estimatedFtpWatts: null,
      },
      {
        date: localDateKey(bestAt),
        setFtpWatts: 240,
        estimatedFtpWatts: 190,
      },
      {
        date: localDateKey(clearedAt),
        setFtpWatts: null,
        estimatedFtpWatts: 190,
      },
    ])
  })

  it('rebuilds set FTP from ride snapshots only before the first log entry', () => {
    const now = new Date('2026-06-01T12:00:00.000Z')
    const early = '2026-01-05T12:00:00.000Z'
    const repeated = '2026-01-20T12:00:00.000Z'
    const raised = '2026-01-25T12:00:00.000Z'
    const logged = '2026-02-01T12:00:00.000Z'
    const later = '2026-02-10T12:00:00.000Z'
    const result = buildFtpProgression({
      activities: [
        activity('early', steady(100, 30), early, 230),
        activity('repeated', steady(100, 30), repeated, 230),
        activity('raised', steady(100, 30), raised, 235),
        activity('later', steady(100, 30), later, 260),
      ],
      ftpHistory: [{ setAt: logged, ftpWatts: 250 }],
      currentFtpWatts: 250,
      now,
    })
    expect(result.points).toEqual([
      {
        date: localDateKey(early),
        setFtpWatts: 230,
        estimatedFtpWatts: null,
      },
      {
        date: localDateKey(raised),
        setFtpWatts: 235,
        estimatedFtpWatts: null,
      },
      {
        date: localDateKey(logged),
        setFtpWatts: 250,
        estimatedFtpWatts: null,
      },
    ])
  })

  it('dates an unlogged profile FTP that differs from the last step as today', () => {
    const now = new Date('2026-06-01T12:00:00.000Z')
    const today = localDateKey(now.toISOString())
    const early = '2026-01-05T12:00:00.000Z'
    const result = buildFtpProgression({
      activities: [activity('early', steady(100, 30), early, 230)],
      ftpHistory: [],
      currentFtpWatts: 260,
      now,
    })
    expect(result.points).toEqual([
      {
        date: localDateKey(early),
        setFtpWatts: 230,
        estimatedFtpWatts: null,
      },
      {
        date: today,
        setFtpWatts: 260,
        estimatedFtpWatts: null,
      },
    ])

    const onlyCurrent = buildFtpProgression({
      activities: [],
      ftpHistory: [],
      currentFtpWatts: 250,
      now,
    })
    expect(onlyCurrent.points).toEqual([
      { date: today, setFtpWatts: 250, estimatedFtpWatts: null },
    ])
  })

  it('estimates FTP from Power Meter watts when they were recorded', () => {
    const now = new Date('2026-06-01T12:00:00.000Z')
    const started = '2026-03-01T12:00:00.000Z'
    const ride = activity('metered', [], started)
    ride.achievedPowerProfile = Array.from({ length: 1200 }, (_, tSec) => ({
      tSec,
      watts: 300,
      meterWatts: 200,
    }))
    const result = buildFtpProgression({
      activities: [ride],
      ftpHistory: [],
      currentFtpWatts: null,
      now,
    })
    expect(result.points).toEqual([
      {
        date: localDateKey(started),
        setFtpWatts: null,
        estimatedFtpWatts: 190,
      },
    ])
  })
})
