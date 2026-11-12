import { describe, expect, it } from 'vitest'
import {
  buildDailyTss,
  computeTrainingForm,
} from './trainingForm.js'

describe('computeTrainingForm', () => {
  it('starts at zero Form with empty daily TSS and is not reliable', () => {
    const result = computeTrainingForm([], '2026-11-12')
    expect(result.asOf).toBe('2026-11-12')
    expect(result.fitness).toBe(0)
    expect(result.fatigue).toBe(0)
    expect(result.form).toBe(0)
    expect(result.ctl).toBe(0)
    expect(result.atl).toBe(0)
    expect(result.tsb).toBe(0)
    expect(result.historyDays).toBe(0)
    expect(result.reliable).toBe(false)
    expect(result.series).toEqual([])
  })

  it('applies Banister 42/7 EWMA for one load day and pads zeros to asOf', () => {
    const result = computeTrainingForm(
      [{ date: '2026-11-10', trainingStressScore: 100 }],
      '2026-11-12',
    )
    // Day 1: CTL=100/42, ATL=100/7
    expect(result.series[0]).toMatchObject({
      date: '2026-11-10',
      trainingStressScore: 100,
      fitness: 2.4,
      fatigue: 14.3,
      form: -11.9,
    })
    // Two zero days: decay toward 0
    expect(result.series).toHaveLength(3)
    expect(result.series[2]!.date).toBe('2026-11-12')
    expect(result.series[2]!.trainingStressScore).toBe(0)
    expect(result.asOf).toBe('2026-11-12')
    expect(result.fitness).toBe(result.series[2]!.fitness)
    expect(result.fatigue).toBe(result.series[2]!.fatigue)
    expect(result.form).toBe(result.series[2]!.form)
    expect(result.ctl).toBe(result.fitness)
    expect(result.atl).toBe(result.fatigue)
    expect(result.tsb).toBe(result.form)
    expect(result.historyDays).toBe(3)
    expect(result.reliable).toBe(false)
  })

  it('sums bike Activity TSS and completed sport Blocker External Load by local day', () => {
    const daily = buildDailyTss({
      activities: [
        {
          startedAt: '2026-11-10T18:00:00.000Z',
          trainingStressScore: 80,
        },
        {
          startedAt: '2026-11-10T07:00:00.000Z',
          trainingStressScore: 20,
        },
        {
          startedAt: '2026-11-11T12:00:00.000Z',
          trainingStressScore: null,
        },
      ],
      blockers: [
        {
          kind: 'run',
          status: 'completed',
          startsAt: '2026-11-10T07:00:00.000Z',
          trainingStressScore: 45,
        },
        {
          kind: 'run',
          status: 'planned',
          startsAt: '2026-11-12T07:00:00.000Z',
          trainingStressScore: null,
        },
        {
          kind: 'social',
          status: 'planned',
          startsAt: '2026-11-10T19:00:00.000Z',
          trainingStressScore: null,
        },
        {
          kind: 'gym',
          status: 'skipped',
          startsAt: '2026-11-09T18:00:00.000Z',
          trainingStressScore: 99,
        },
      ],
    })
    expect(daily).toEqual([
      { date: '2026-11-10', trainingStressScore: 145 },
    ])
  })
})
