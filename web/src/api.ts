export type WorkoutStepType = 'warmup' | 'steady' | 'recovery' | 'cooldown'

export type PowerZoneId = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type WorkoutStep = {
  type: WorkoutStepType
  durationSec: number
  targetWatts: number | null
  percentFtp: number | null
  zone: PowerZoneId | null
}

export type RiderProfileZone = {
  zone: PowerZoneId
  name: string
  minPercentFtp: number
  maxPercentFtp: number | null
  minWatts: number
  maxWatts: number | null
  targetWatts: number
}

export type RiderProfile = {
  schemaVersion: number
  ftpWatts: number | null
  updatedAt: string
  zones: RiderProfileZone[] | null
}

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
  id: string
  name: string
  steps: WorkoutStep[]
  plannedPowerProfile: PowerProfilePoint[]
  createdAt: string
}

export type ActivityStravaUpload = {
  uploadId: number
  stravaActivityId: number | null
  uploadedAt: string
}

export type Activity = {
  id: string
  startedAt: string
  durationSec: number
  averagePowerWatts: number | null
  maxPowerWatts: number | null
  achievedPowerProfile: PowerProfilePoint[]
  plannedPowerProfile: PowerProfilePoint[] | null
  workoutId: string | null
  stravaUpload?: ActivityStravaUpload | null
}

export type StravaLinkStatus = {
  configured: boolean
  linked: boolean
  athleteName: string | null
  athleteId: number | null
  scope: string | null
}

export type ScheduledRide = {
  id: string
  workoutId: string
  startsAt: string
  createdAt: string
}

async function parseJson<T>(res: Response): Promise<T> {
  const body = (await res.json()) as T & { error?: string }
  if (!res.ok) {
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return body
}

function normalizeStep(step: WorkoutStep): WorkoutStep {
  return {
    type: step.type,
    durationSec: step.durationSec,
    targetWatts: step.targetWatts ?? null,
    percentFtp: step.percentFtp ?? null,
    zone: step.zone ?? null,
  }
}

function normalizeWorkout(workout: Workout): Workout {
  return {
    ...workout,
    steps: workout.steps.map(normalizeStep),
  }
}

export async function listWorkouts(): Promise<Workout[]> {
  const res = await fetch('/api/workouts')
  const body = await parseJson<{ workouts: Workout[] }>(res)
  return body.workouts.map(normalizeWorkout)
}

export async function createWorkout(input: {
  name: string
  steps: WorkoutStep[]
}): Promise<Workout> {
  const res = await fetch('/api/workouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = await parseJson<{ workout: Workout }>(res)
  return normalizeWorkout(body.workout)
}

export async function listActivities(
  options: { pastDays?: number; since?: string; until?: string } = { pastDays: 14 },
): Promise<Activity[]> {
  const params = new URLSearchParams()
  if (options.pastDays !== undefined) {
    params.set('pastDays', String(options.pastDays))
  }
  if (options.since) params.set('since', options.since)
  if (options.until) params.set('until', options.until)
  const qs = params.toString()
  const res = await fetch(`/api/activities${qs ? `?${qs}` : ''}`)
  const body = await parseJson<{ activities: Activity[] }>(res)
  return body.activities
}

export async function listScheduledRides(options: {
  since?: string
  until?: string
} = {}): Promise<ScheduledRide[]> {
  const params = new URLSearchParams()
  if (options.since) params.set('since', options.since)
  if (options.until) params.set('until', options.until)
  const qs = params.toString()
  const res = await fetch(`/api/scheduled-rides${qs ? `?${qs}` : ''}`)
  const body = await parseJson<{ scheduledRides: ScheduledRide[] }>(res)
  return body.scheduledRides
}

export async function createScheduledRide(input: {
  workoutId: string
  startsAt: string
}): Promise<ScheduledRide> {
  const res = await fetch('/api/scheduled-rides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = await parseJson<{ scheduledRide: ScheduledRide }>(res)
  return body.scheduledRide
}

export async function deleteScheduledRide(id: string): Promise<void> {
  const res = await fetch(`/api/scheduled-rides/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  await parseJson<{ ok: boolean }>(res)
}

export type SaveActivityInput = {
  startedAt: string
  durationSec: number
  averagePowerWatts: number | null
  maxPowerWatts: number | null
  achievedPowerProfile: PowerProfilePoint[]
  plannedPowerProfile: PowerProfilePoint[] | null
  workoutId: string | null
}

export async function saveActivity(input: SaveActivityInput): Promise<Activity> {
  const res = await fetch('/api/activities', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = await parseJson<{ activity: Activity }>(res)
  return body.activity
}

export async function companionHealthy(): Promise<boolean> {
  try {
    const res = await fetch('/api/health')
    return res.ok
  } catch {
    return false
  }
}

export async function getRiderProfile(): Promise<RiderProfile> {
  const res = await fetch('/api/profile')
  const body = await parseJson<{ profile: RiderProfile }>(res)
  return body.profile
}

export async function setFtp(ftpWatts: number): Promise<RiderProfile> {
  const res = await fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ftpWatts }),
  })
  const body = await parseJson<{ profile: RiderProfile }>(res)
  return body.profile
}

export async function clearScheduledRides(input: {
  since: string
  until: string
}): Promise<number> {
  const res = await fetch('/api/scheduled-rides/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const body = await parseJson<{ deleted: number }>(res)
  return body.deleted
}

export async function getStravaStatus(): Promise<StravaLinkStatus> {
  const res = await fetch('/api/strava/status')
  return parseJson<StravaLinkStatus>(res)
}

export async function disconnectStrava(): Promise<void> {
  const res = await fetch('/api/strava/disconnect', { method: 'POST' })
  await parseJson<{ ok: boolean }>(res)
}

export async function uploadActivityToStrava(input: {
  activityId: string
  fitBase64: string
  name?: string
  force?: boolean
}): Promise<{
  uploadId: number
  stravaActivityId: number | null
  activity: Activity
}> {
  const res = await fetch('/api/strava/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJson(res)
}

/** Start Strava OAuth (full navigation; companion redirects to Strava). */
export function beginStravaAuthorize(): void {
  window.location.href = '/api/strava/authorize'
}
