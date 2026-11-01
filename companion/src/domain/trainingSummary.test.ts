import { describe, expect, it } from 'vitest'
import { buildTrainingSummary, checkTrainingWeek, sessionKind } from './trainingSummary.js'

const step = (
  type: 'warmup' | 'steady' | 'recovery' | 'cooldown',
  durationSec: number,
  percentFtp: number | null,
  zone: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null = null,
) => ({
  type,
  durationSec,
  targetWatts: null,
  percentFtp,
  zone,
})

const zones = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }

describe('buildTrainingSummary', () => {
  it('rolls up load without power-profile samples and marks the planned session hard', () => {
    const summary = buildTrainingSummary({
      ftpWatts: 250,
      workouts: [
        {
          id: 'w-hit',
          name: '4x8 min at 106% FTP',
          steps: [
            step('warmup', 300, 50),
            step('steady', 480, 106),
            step('recovery', 480, 55),
          ],
        },
      ],
      activities: [
        {
          id: 'a1',
          startedAt: '2026-10-20T18:00:00.000Z',
          durationSec: 3600,
          purpose: 'endurance',
          averagePowerWatts: 160,
          workoutId: null,
          sessionLoad: {
            ftpWattsAtSave: 250,
            normalizedPowerWatts: 155,
            intensityFactor: 0.62,
            trainingStressScore: 40,
            timeInZonesSec: { ...zones, 2: 3500 },
          },
          sessionAdherence: null,
        },
        {
          id: 'a2',
          startedAt: '2026-10-22T18:00:00.000Z',
          durationSec: 2400,
          purpose: 'raise VO2',
          averagePowerWatts: 230,
          workoutId: 'w-hit',
          sessionLoad: {
            ftpWattsAtSave: 250,
            normalizedPowerWatts: 210,
            intensityFactor: 0.84,
            trainingStressScore: 70,
            timeInZonesSec: { ...zones, 2: 600, 4: 900, 5: 900 },
          },
          sessionAdherence: { completionRatio: 1, targetAdherence: 0.7 },
        },
      ],
      scheduledRides: [
        {
          id: 's-miss',
          startsAt: '2026-10-21T18:00:00.000Z',
          status: 'planned',
          missed: true,
          purpose: 'endurance',
          workoutId: 'w-easy',
        },
      ],
    })

    expect(summary.activities[0]).not.toHaveProperty('achievedPowerProfile')
    expect(summary.activities.map((a) => a.kind)).toEqual(['easy', 'hard'])
    expect(summary.rollup).toMatchObject({
      tssSum: 110,
      easySec: 4100,
      thresholdSec: 900,
      aboveSec: 900,
      hardSessionCount: 1,
      missedCount: 1,
      lastHard: { id: 'a2', targetAdherence: 0.7 },
    })
    expect(summary.activities[1]?.workout?.steps).toHaveLength(3)
  })

  it('reports planned watts and the average held on the main efforts, ignoring warmup bursts', () => {
    const workStart = 300 + 300 + 180 + 3 * (15 + 60)
    const workEnd = workStart + 360
    const achievedPowerProfile = []
    for (let tSec = 0; tSec < workEnd; tSec++) {
      const opener =
        tSec >= 780 &&
        [0, 1, 2].some((rep) => {
          const start = 780 + rep * 75
          return tSec >= start && tSec < start + 15
        })
      achievedPowerProfile.push({
        tSec,
        watts: tSec >= workStart ? 203 : opener ? 400 : 100,
      })
    }

    const summary = buildTrainingSummary({
      ftpWatts: 200,
      workouts: [
        {
          id: 'w-thr',
          name: 'Threshold 3x6 min',
          steps: [
            step('warmup', 300, 50),
            step('warmup', 300, 65),
            step('warmup', 180, 80),
            {
              type: 'repeat',
              count: 3,
              steps: [step('warmup', 15, 120), step('warmup', 60, 50)],
            },
            {
              type: 'steady',
              durationSec: 360,
              targetWatts: 190,
              percentFtp: null,
              zone: null,
            },
          ],
        },
      ],
      activities: [
        {
          id: 'a-thr',
          startedAt: '2026-10-19T16:27:11.344Z',
          durationSec: workEnd,
          purpose: 'threshold',
          averagePowerWatts: 150,
          workoutId: 'w-thr',
          sessionLoad: null,
          sessionAdherence: { completionRatio: 1, targetAdherence: 0.754 },
          achievedPowerProfile,
        },
      ],
      scheduledRides: [],
    })

    expect(summary.activities[0]).not.toHaveProperty('achievedPowerProfile')
    expect(summary.rollup.lastHard).toEqual({
      id: 'a-thr',
      startedAt: '2026-10-19T16:27:11.344Z',
      targetAdherence: 0.754,
      work: { plannedWatts: 190, averageWatts: 203 },
    })
  })
})

describe('sessionKind', () => {
  it('keeps a Zone 2 ride easy when the 15s openers are warmup steps', () => {
    expect(
      sessionKind(
        [
          step('warmup', 300, 50),
          step('warmup', 300, 65),
          step('warmup', 180, 80),
          {
            type: 'repeat',
            count: 3,
            steps: [step('warmup', 15, 120), step('warmup', 60, 50)],
          },
          step('steady', 2400, null, 2),
        ],
        null,
        200,
      ),
    ).toBe('easy')
  })
})

describe('checkTrainingWeek', () => {
  const noon = (day: number) =>
    new Date(2026, 10, day, 12, 0, 0).toISOString()

  const ride = (
    id: string,
    day: number,
    steps: ReturnType<typeof step>[],
  ) => ({
    id,
    startsAt: noon(day),
    status: 'planned' as const,
    workout: { id: `w-${id}`, name: id, steps },
  })

  it('flags a third moderate day, adjacent hard days, and zone 6', () => {
    const result = checkTrainingWeek({
      ftpWatts: 250,
      maxHardDaysPerWeek: 2,
      rides: [
        ride('tempo-a', 2, [step('steady', 1200, 82)]),
        ride('tempo-b', 4, [step('steady', 1200, 82)]),
        ride('tempo-c', 6, [
          step('steady', 1200, 82),
          step('steady', 30, null, 6),
        ]),
      ],
    })

    expect(result.moderateBandCount).toBe(3)
    expect(result.violations.join('\n')).toMatch(/zone 6/i)
    expect(result.violations.join('\n')).toMatch(/76-94/)
  })

  it('flags hard sessions with no easy day between them', () => {
    const result = checkTrainingWeek({
      ftpWatts: 250,
      maxHardDaysPerWeek: 2,
      rides: [
        ride('hit-a', 3, [step('steady', 480, 106)]),
        ride('hit-b', 4, [step('steady', 480, 106)]),
      ],
    })

    expect(result.hardCount).toBe(2)
    expect(result.violations.join('\n')).toMatch(/no easy day between/i)
  })

  it('accepts one HIT day and one sweet-spot day with an easy ride between', () => {
    const result = checkTrainingWeek({
      ftpWatts: 250,
      maxHardDaysPerWeek: 2,
      rides: [
        ride('hit', 2, [step('steady', 480, 106), step('recovery', 480, 55)]),
        ride('easy', 3, [step('steady', 3600, 65)]),
        ride('ss', 4, [step('steady', 1200, 90)]),
      ],
    })

    expect(result.violations).toEqual([])
    expect(result.hardCount).toBe(2)
  })
})
