type ActivityLike = { id: string }

type ScheduledRideLike = {
  status?: string | null
  activityId?: string | null
}

/**
 * Activities for a calendar day, omitting ones already listed as a completed
 * Scheduled Ride (matched by activityId). Free rides and rides that are still
 * planned or skipped stay.
 */
export function activitiesBesideCompletedRides<T extends ActivityLike>(
  activities: T[],
  rides: ScheduledRideLike[],
): T[] {
  const covered = new Set<string>()
  for (const ride of rides) {
    if (ride.status === 'completed' && ride.activityId) {
      covered.add(ride.activityId)
    }
  }
  if (covered.size === 0) return activities
  return activities.filter((activity) => !covered.has(activity.id))
}
