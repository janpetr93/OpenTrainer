import { describe, expect, it } from 'vitest'
import { scheduledRidesBesideCompletedActivity } from './scheduledRidesBesideCompletedActivity'

describe('scheduledRidesBesideCompletedActivity', () => {
  const completed = {
    id: 'ride-done',
    status: 'completed' as const,
    activityId: 'activity-1',
  }
  const planned = {
    id: 'ride-plan',
    status: 'planned' as const,
    activityId: null,
  }

  it('drops a completed Scheduled Ride when its Activity is on the day', () => {
    const visible = scheduledRidesBesideCompletedActivity(
      [completed, planned],
      [{ id: 'activity-1' }],
    )
    expect(visible).toEqual([planned])
  })

  it('keeps a completed Scheduled Ride when the Activity is not on the day', () => {
    const skipped = {
      id: 'ride-skip',
      status: 'skipped' as const,
      activityId: 'activity-1',
    }
    const visible = scheduledRidesBesideCompletedActivity(
      [completed, skipped],
      [],
    )
    expect(visible.map((ride) => ride.id)).toEqual(['ride-done', 'ride-skip'])
  })
})
