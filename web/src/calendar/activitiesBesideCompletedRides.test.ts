import { describe, expect, it } from 'vitest'
import { activitiesBesideCompletedRides } from './activitiesBesideCompletedRides'

describe('activitiesBesideCompletedRides', () => {
  const linked = { id: 'activity-1' }
  const freeRide = { id: 'activity-2' }

  it('drops an Activity already shown as a completed Scheduled Ride', () => {
    const visible = activitiesBesideCompletedRides([linked, freeRide], [
      { status: 'completed', activityId: 'activity-1' },
    ])
    expect(visible).toEqual([freeRide])
  })

  it('keeps an Activity when the Scheduled Ride is not completed', () => {
    const visible = activitiesBesideCompletedRides([linked], [
      { status: 'planned', activityId: 'activity-1' },
      { status: 'skipped', activityId: 'activity-1' },
      { status: 'completed', activityId: null },
    ])
    expect(visible).toEqual([linked])
  })
})
