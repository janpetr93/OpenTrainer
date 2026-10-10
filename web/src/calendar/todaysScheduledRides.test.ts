import { describe, expect, it } from 'vitest'
import { scheduledRidesForLocalDay } from './todaysScheduledRides'

describe('scheduledRidesForLocalDay', () => {
  const today = new Date(2026, 9, 9, 12, 0, 0)
  const rides = [
    {
      id: 'b',
      workoutId: 'w2',
      startsAt: new Date(2026, 9, 9, 18, 0, 0).toISOString(),
      createdAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'a',
      workoutId: 'w1',
      startsAt: new Date(2026, 9, 9, 7, 0, 0).toISOString(),
      createdAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'other',
      workoutId: 'w3',
      startsAt: new Date(2026, 9, 10, 7, 0, 0).toISOString(),
      createdAt: '2026-10-01T00:00:00.000Z',
    },
  ]

  it('keeps only rides on the local calendar day, sorted by startsAt', () => {
    expect(scheduledRidesForLocalDay(rides, today).map((r) => r.id)).toEqual([
      'a',
      'b',
    ])
  })

  it('returns empty when nothing is scheduled that day', () => {
    expect(
      scheduledRidesForLocalDay(rides, new Date(2026, 9, 11, 8, 0, 0)),
    ).toEqual([])
  })
})
