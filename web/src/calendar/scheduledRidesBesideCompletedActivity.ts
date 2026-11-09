type ActivityLike = { id: string }

type ScheduledRideLike = {
  status?: string | null
  activityId?: string | null
}

/**
 * Scheduled Rides still listed on a calendar day.
 * A completed ride whose Activity is on this day is omitted — the Activity
 * has the ridden stats. Planned, skipped, and completed rides with no
 * matching Activity stay.
 */
export function scheduledRidesBesideCompletedActivity<
  T extends ScheduledRideLike,
>(rides: T[], activities: ActivityLike[]): T[] {
  const activityIds = new Set(activities.map((activity) => activity.id))
  return rides.filter((ride) => {
    if (ride.status !== 'completed' || !ride.activityId) return true
    return !activityIds.has(ride.activityId)
  })
}
