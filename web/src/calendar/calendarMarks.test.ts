import { describe, expect, it } from 'vitest'
import type { Activity, Blocker, ScheduledRide } from '../api'
import { marksForDay } from './calendarMarks'

function ride(partial: Partial<ScheduledRide> & Pick<ScheduledRide, 'id'>): ScheduledRide {
  return {
    workoutId: 'w',
    startsAt: '2026-11-17T07:00:00.000Z',
    createdAt: '2026-11-01T00:00:00.000Z',
    status: 'planned',
    ...partial,
  }
}

describe('marksForDay', () => {
  it('draws an outline bicycle for a plan, a solid bicycle for an Activity, and an outline Blocker', () => {
    const activity = { id: 'act-1' } as Activity
    const marks = marksForDay({
      scheduled: [
        ride({ id: 'ride-1', status: 'planned' }),
        ride({
          id: 'ride-done',
          status: 'completed',
          activityId: 'act-1',
        }),
        ride({ id: 'ride-skip', status: 'skipped' }),
      ],
      activities: [activity],
      blockers: [
        {
          id: 'run-1',
          kind: 'run',
          startsAt: '2026-11-17T06:00:00.000Z',
          allDay: false,
          durationMin: 50,
          label: 'easy 50 min',
          status: 'planned',
          trainingStressScore: null,
          createdAt: '2026-11-01T00:00:00.000Z',
        } satisfies Blocker,
        {
          id: 'run-done',
          kind: 'run',
          startsAt: '2026-11-16T06:00:00.000Z',
          allDay: false,
          durationMin: 40,
          label: 'done run',
          status: 'completed',
          trainingStressScore: 42,
          createdAt: '2026-11-01T00:00:00.000Z',
        } satisfies Blocker,
      ],
    })

    expect(marks).toEqual([
      { id: 'ride-1', shape: 'bicycle', filled: false, title: 'Scheduled' },
      { id: 'ride-skip', shape: 'bicycle', filled: false, title: 'Skipped' },
      { id: 'act-1', shape: 'bicycle', filled: true, title: 'Activity' },
      { id: 'run-1', shape: 'run', filled: false, title: 'easy 50 min' },
      { id: 'run-done', shape: 'run', filled: true, title: 'done run' },
    ])
  })
})
