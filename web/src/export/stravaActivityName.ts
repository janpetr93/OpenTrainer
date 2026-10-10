import type { Activity, Workout } from '../api'

/** Strava activity title for an OpenTrainer Activity upload. */
export function stravaActivityName(
  activity: Pick<Activity, 'workoutId'>,
  workouts: ReadonlyArray<Pick<Workout, 'id' | 'name'>>,
): string {
  if (!activity.workoutId) return 'OpenTrainer: Free Ride'
  const name = workouts.find((w) => w.id === activity.workoutId)?.name
  return `OpenTrainer: ${name ?? 'Workout'}`
}
