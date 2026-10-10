import type {
  ScheduledRide,
  ScheduledRideStatus,
  ScheduledRideView,
} from './types.js'

export function isMissedScheduledRide(
  ride: Pick<ScheduledRide, 'status' | 'startsAt'>,
  nowMs: number = Date.now(),
): boolean {
  if (ride.status !== 'planned') return false
  const starts = Date.parse(ride.startsAt)
  if (Number.isNaN(starts)) return false
  return starts < nowMs
}

export function toScheduledRideView(
  ride: ScheduledRide,
  nowMs: number = Date.now(),
): ScheduledRideView {
  return {
    ...ride,
    missed: isMissedScheduledRide(ride, nowMs),
  }
}

export function normalizeScheduledRideStatus(
  value: unknown,
): ScheduledRideStatus {
  if (value === 'completed' || value === 'skipped' || value === 'planned') {
    return value
  }
  return 'planned'
}

/** Fill status fields for Scheduled Rides written before outcomes existed. */
export function hydrateScheduledRide(raw: ScheduledRide): ScheduledRide {
  return {
    ...raw,
    status: normalizeScheduledRideStatus(
      (raw as { status?: unknown }).status,
    ),
    activityId:
      raw.activityId === undefined || raw.activityId === null
        ? null
        : raw.activityId,
    skipReason:
      raw.skipReason === undefined || raw.skipReason === null
        ? null
        : raw.skipReason,
  }
}
