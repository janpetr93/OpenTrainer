import type { PowerZoneId } from './cogganZones.js'

export const STORE_SCHEMA_VERSION = 1 as const

export type WorkoutStepType = 'warmup' | 'steady' | 'recovery' | 'cooldown'

export type WorkoutStep = {
  type: WorkoutStepType
  durationSec: number
  /** Absolute target watts; null if using %FTP/zone or free-spin. */
  targetWatts: number | null
  /** Percent of FTP (e.g. 95). Null if unused. */
  percentFtp: number | null
  /** Coggan zone 1–7. Null if unused. */
  zone: PowerZoneId | null
}

/** Watts over elapsed time (Power Profile). Achieved rides may also carry sensors. */
export type PowerProfilePoint = {
  tSec: number
  watts: number
  /** Present when a Heart Rate Monitor was fresh at sample time. */
  hrBpm?: number | null
  /** Present when a Cadence Sensor (or trainer cadence) was fresh at sample time. */
  cadenceRpm?: number | null
  /** Present when Power Meter was fresh (comparison only; not primary power). */
  meterWatts?: number | null
}

export type Workout = {
  schemaVersion: typeof STORE_SCHEMA_VERSION
  id: string
  name: string
  steps: WorkoutStep[]
  /** Snapshot at create time (may be 0 for zone/%FTP until FTP known). */
  plannedPowerProfile: PowerProfilePoint[]
  createdAt: string
  updatedAt: string
}

/** Create payload (Workout Specs without id/timestamps/profile). */
export type CreateWorkoutInput = {
  name: string
  steps: WorkoutStep[]
}

/** Record of a Strava Uploads API submission for an Activity. */
export type ActivityStravaUpload = {
  uploadId: number
  stravaActivityId: number | null
  uploadedAt: string
}

export type Activity = {
  schemaVersion: typeof STORE_SCHEMA_VERSION
  id: string
  startedAt: string
  durationSec: number
  averagePowerWatts: number | null
  maxPowerWatts: number | null
  achievedPowerProfile: PowerProfilePoint[]
  /** Present when the ride followed a Workout; null for Free Ride. */
  plannedPowerProfile: PowerProfilePoint[] | null
  workoutId: string | null
  createdAt: string
  /** Set after a successful Strava API upload (optional). */
  stravaUpload?: ActivityStravaUpload | null
}

/** OAuth tokens for the rider's Strava Link (Local Store). */
export type StravaLink = {
  schemaVersion: typeof STORE_SCHEMA_VERSION
  athleteId: number
  athleteName: string | null
  accessToken: string
  refreshToken: string
  /** Access token expiry as Unix seconds. */
  expiresAt: number
  scope: string
  updatedAt: string
}

export type ListActivitiesQuery = {
  since?: string
  until?: string
  pastDays?: number
}

export type ScheduledRide = {
  schemaVersion: typeof STORE_SCHEMA_VERSION
  id: string
  workoutId: string
  startsAt: string
  createdAt: string
}

export type CreateScheduledRideInput = {
  workoutId: string
  startsAt: string
}

export type ListScheduledRidesQuery = {
  since?: string
  until?: string
}

/** Durable week-planning brief on the Rider Profile. */
export type TrainingIntent = {
  goal: string
  horizon: string | null
  note: string | null
}

export type RiderProfile = {
  schemaVersion: typeof STORE_SCHEMA_VERSION
  ftpWatts: number | null
  /** Null when the rider has not set a Training Intent. */
  intent: TrainingIntent | null
  updatedAt: string
}
