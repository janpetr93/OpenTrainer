import { dayKey } from './monthGrid'

type RideLike = { startsAt: string }

/** Scheduled Rides on the rider's local calendar day, earliest first. */
export function scheduledRidesForLocalDay<T extends RideLike>(
  rides: T[],
  date: Date,
): T[] {
  const key = dayKey(date)
  return rides
    .filter((ride) => dayKey(new Date(ride.startsAt)) === key)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    )
}
