import type { PowerZoneId } from './cogganZones.js'
import type { SessionAdherence } from './sessionAdherence.js'
import type { SessionLoad } from './sessionLoad.js'

export const STORE_SCHEMA_VERSION = 1 as const

export type { SessionAdherence, SessionLoad }

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

/** Plays `steps` `count` times. One level only — inner steps are not repeats. */
export type WorkoutRepeat = {
  type: 'repeat'
  /** Integer from 2 to 40. */
  count: number
  steps: WorkoutStep[]
}

export type WorkoutItem = WorkoutStep | WorkoutRepeat

/** Watts over elapsed time (Power Profile). Achieved rides may also carry sensors. */
export type PowerProfilePoint = {
  tSec: number
  watts: number
  /** Present when a Heart Rate Monitor was fresh at sample time. */
  hrBpm?: number | null
  /** Present when a Cadence Sensor (or trainer cadence) was fresh at sample time. */
  cadenceRpm?: number | null
  /** Present when Power Meter was fresh in trainer-primary (comparison). */
  meterWatts?: number | null
  /** Present when Trainer was fresh in meter-primary (ERG / alignment). */
  trainerWatts?: number | null
}

export type PowerSourceMode = 'meter' | 'trainer'

/** Durable ERG Calibration map (Local Store; not Rider Profile). */
export type ErgCalibration = {
  schemaVersion: typeof STORE_SCHEMA_VERSION
  /** Typical Meter/Trainer ratio. Open-loop ERG = target / scale + offset. */
  scale: number
  offsetWatts: number
  updatedAt: string
}

export type Workout = {
  schemaVersion: typeof STORE_SCHEMA_VERSION
  id: string
  name: string
  steps: WorkoutItem[]
  /** Snapshot at create time (may be 0 for zone/%FTP until FTP known). */
  plannedPowerProfile: PowerProfilePoint[]
  createdAt: string
  updatedAt: string
}

/** Create payload (Workout Specs without id/timestamps/profile). */
export type CreateWorkoutInput = {
  name: string
  steps: WorkoutItem[]
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
  /** Scheduled Ride this Activity completed; null for Free Ride / unlinked. */
  scheduledRideId: string | null
  /** Session Purpose copied from the Scheduled Ride when ridden; null if none. */
  purpose: string | null
  /** Coggan NP/IF/TSS + time-in-zone; null when FTP unset at compute time. */
  sessionLoad: SessionLoad | null
  /** Prescription adherence; null for Free Ride. */
  sessionAdherence: SessionAdherence | null
  /**
   * Mean Meter − Trainer watts over paired samples; null when none.
   */
  averageAlignmentDeltaWatts: number | null
  /** Power Source Mode locked at Start; omitted on older Activities. */
  primaryPowerSource?: PowerSourceMode | null
  createdAt: string
  /** Set after a successful Strava API upload (optional). */
  stravaUpload?: ActivityStravaUpload | null
}

/** OAuth tokens for the Calendar Mirror (Local Store). Tokens may be cleared on unlink while calendarId remains. */
export type GoogleCalendarLink = {
  schemaVersion: typeof STORE_SCHEMA_VERSION
  calendarId: string | null
  accessToken: string | null
  refreshToken: string | null
  /** Access token expiry as Unix seconds. Null when unlinked. */
  expiresAt: number | null
  scope: string | null
  updatedAt: string
  lastError: string | null
}

/** Scheduled Ride id → Google event id for the Calendar Mirror. */
export type GoogleCalendarEventIndex = {
  schemaVersion: typeof STORE_SCHEMA_VERSION
  byRideId: Record<string, string>
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

export type ScheduledRideStatus = 'planned' | 'completed' | 'skipped'

export type ScheduledRide = {
  schemaVersion: typeof STORE_SCHEMA_VERSION
  id: string
  workoutId: string
  startsAt: string
  /** Session Purpose — what this session is for (coaching rationale). */
  purpose: string | null
  status: ScheduledRideStatus
  /** Set when status is completed. */
  activityId: string | null
  /** Optional reason when status is skipped. */
  skipReason: string | null
  createdAt: string
}

/** Scheduled Ride plus derived missed flag for API/MCP. */
export type ScheduledRideView = ScheduledRide & {
  /** True when still planned and startsAt is in the past. */
  missed: boolean
}

export type CreateScheduledRideInput = {
  workoutId: string
  startsAt: string
  purpose?: string | null
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
  /** Optional cap on hard sessions per week for planning. */
  maxHardDaysPerWeek: number | null
  /**
   * Preferred long-ride weekday: 0 = Sunday … 6 = Saturday (JS getDay).
   */
  preferredLongRideWeekday: number | null
  /** Equipment / injury / schedule caveats for the planner. */
  constraintsNote: string | null
}

export type RiderProfile = {
  schemaVersion: typeof STORE_SCHEMA_VERSION
  ftpWatts: number | null
  /** Null when the rider has not set a Training Intent. */
  intent: TrainingIntent | null
  updatedAt: string
}

/** Cached Mean Maximal Power (lifetime bests). */
export type MmpCachePoint = {
  durationSec: number
  watts: number | null
  activityId: string | null
  startedAt: string | null
}

export type MmpCache = {
  schemaVersion: typeof STORE_SCHEMA_VERSION
  points: MmpCachePoint[]
  computedAt: string
  activityCount: number
  latestActivityId: string | null
  latestCreatedAt: string | null
}
