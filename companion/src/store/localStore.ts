import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { PowerZoneId } from '../domain/cogganZones.js'
import { zonesFromFtp } from '../domain/cogganZones.js'
import { buildPlannedPowerProfile } from '../domain/plannedPowerProfile.js'
import { assertStepPrescription } from '../domain/resolveTarget.js'
import {
  STORE_SCHEMA_VERSION,
  type Activity,
  type ActivityStravaUpload,
  type CreateScheduledRideInput,
  type CreateWorkoutInput,
  type ListActivitiesQuery,
  type ListScheduledRidesQuery,
  type RiderProfile,
  type ScheduledRide,
  type StravaLink,
  type Workout,
  type WorkoutStep,
  type WorkoutStepType,
} from '../domain/types.js'

const STEP_TYPES: WorkoutStepType[] = ['warmup', 'steady', 'recovery', 'cooldown']
const PROFILE_FILE = 'profile.json'
const STRAVA_LINK_FILE = 'strava-link.json'

export type SaveActivityInput = Omit<Activity, 'schemaVersion' | 'id' | 'createdAt'>

export type RiderProfileView = RiderProfile & {
  zones: ReturnType<typeof zonesFromFtp> | null
}

function normalizeStep(raw: WorkoutStep): WorkoutStep {
  return {
    type: raw.type,
    durationSec: raw.durationSec,
    targetWatts: raw.targetWatts ?? null,
    percentFtp: raw.percentFtp ?? null,
    zone: (raw.zone ?? null) as PowerZoneId | null,
  }
}

export class LocalStore {
  private readonly workoutsDir: string
  private readonly activitiesDir: string
  private readonly scheduledDir: string
  private readonly profilePath: string
  private readonly stravaLinkPath: string

  constructor(private readonly rootDir: string) {
    this.workoutsDir = join(rootDir, 'workouts')
    this.activitiesDir = join(rootDir, 'activities')
    this.scheduledDir = join(rootDir, 'scheduled')
    this.profilePath = join(rootDir, PROFILE_FILE)
    this.stravaLinkPath = join(rootDir, STRAVA_LINK_FILE)
  }

  async ensureReady(): Promise<void> {
    await mkdir(this.workoutsDir, { recursive: true })
    await mkdir(this.activitiesDir, { recursive: true })
    await mkdir(this.scheduledDir, { recursive: true })
  }

  async getRiderProfile(): Promise<RiderProfileView> {
    let profile: RiderProfile
    try {
      profile = await this.readJson<RiderProfile>(this.profilePath)
    } catch {
      profile = {
        schemaVersion: STORE_SCHEMA_VERSION,
        ftpWatts: null,
        updatedAt: new Date(0).toISOString(),
      }
    }
    return {
      ...profile,
      zones:
        profile.ftpWatts !== null && profile.ftpWatts > 0
          ? zonesFromFtp(profile.ftpWatts)
          : null,
    }
  }

  async setFtp(ftpWatts: number): Promise<RiderProfileView> {
    if (!Number.isFinite(ftpWatts) || ftpWatts <= 0 || ftpWatts > 2000) {
      throw new Error('ftpWatts must be a positive number (≤ 2000)')
    }
    const profile: RiderProfile = {
      schemaVersion: STORE_SCHEMA_VERSION,
      ftpWatts: Math.round(ftpWatts),
      updatedAt: new Date().toISOString(),
    }
    await this.writeJson(this.profilePath, profile)
    return this.getRiderProfile()
  }

  async createWorkout(input: CreateWorkoutInput): Promise<Workout> {
    this.assertWorkoutInput(input)
    const steps = input.steps.map(normalizeStep)
    const profile = await this.getRiderProfile()
    const now = new Date().toISOString()
    const workout: Workout = {
      schemaVersion: STORE_SCHEMA_VERSION,
      id: randomUUID(),
      name: input.name.trim(),
      steps,
      plannedPowerProfile: buildPlannedPowerProfile(steps, profile.ftpWatts),
      createdAt: now,
      updatedAt: now,
    }
    await this.writeJson(join(this.workoutsDir, `${workout.id}.json`), workout)
    return workout
  }

  async listWorkouts(): Promise<Workout[]> {
    const files = await this.listJsonFiles(this.workoutsDir)
    const workouts: Workout[] = []
    for (const file of files) {
      const raw = await this.readJson<Workout>(join(this.workoutsDir, file))
      workouts.push({
        ...raw,
        steps: raw.steps.map(normalizeStep),
      })
    }
    return workouts.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async getWorkout(id: string): Promise<Workout | null> {
    try {
      const raw = await this.readJson<Workout>(join(this.workoutsDir, `${id}.json`))
      return { ...raw, steps: raw.steps.map(normalizeStep) }
    } catch {
      return null
    }
  }

  async saveActivity(input: SaveActivityInput): Promise<Activity> {
    const now = new Date().toISOString()
    const activity: Activity = {
      schemaVersion: STORE_SCHEMA_VERSION,
      id: randomUUID(),
      startedAt: input.startedAt,
      durationSec: input.durationSec,
      averagePowerWatts: input.averagePowerWatts,
      maxPowerWatts: input.maxPowerWatts,
      achievedPowerProfile: input.achievedPowerProfile,
      plannedPowerProfile: input.plannedPowerProfile,
      workoutId: input.workoutId,
      createdAt: now,
      stravaUpload: null,
    }
    await this.writeJson(join(this.activitiesDir, `${activity.id}.json`), activity)
    return activity
  }

  async getActivity(id: string): Promise<Activity | null> {
    try {
      return await this.readJson<Activity>(join(this.activitiesDir, `${id}.json`))
    } catch {
      return null
    }
  }

  async setActivityStravaUpload(
    id: string,
    upload: ActivityStravaUpload,
  ): Promise<Activity> {
    const activity = await this.getActivity(id)
    if (!activity) {
      throw new Error(`Activity not found: ${id}`)
    }
    const next: Activity = { ...activity, stravaUpload: upload }
    await this.writeJson(join(this.activitiesDir, `${id}.json`), next)
    return next
  }

  async getStravaLink(): Promise<StravaLink | null> {
    try {
      return await this.readJson<StravaLink>(this.stravaLinkPath)
    } catch {
      return null
    }
  }

  async saveStravaLink(link: StravaLink): Promise<StravaLink> {
    await this.writeJson(this.stravaLinkPath, link)
    return link
  }

  async clearStravaLink(): Promise<void> {
    try {
      await unlink(this.stravaLinkPath)
    } catch {
      // already absent
    }
  }

  async listActivities(query: ListActivitiesQuery = {}): Promise<Activity[]> {
    const { sinceMs, untilMs } = this.resolveBounds(query)
    const files = await this.listJsonFiles(this.activitiesDir)
    const activities: Activity[] = []

    for (const file of files) {
      const activity = await this.readJson<Activity>(join(this.activitiesDir, file))
      const started = Date.parse(activity.startedAt)
      if (Number.isNaN(started)) continue
      if (sinceMs !== null && started < sinceMs) continue
      if (untilMs !== null && started > untilMs) continue
      activities.push(activity)
    }

    return activities.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  async createScheduledRide(input: CreateScheduledRideInput): Promise<ScheduledRide> {
    if (!input.workoutId?.trim()) {
      throw new Error('workoutId is required')
    }
    const workout = await this.getWorkout(input.workoutId)
    if (!workout) {
      throw new Error(`Workout not found: ${input.workoutId}`)
    }
    const startsAtMs = Date.parse(input.startsAt)
    if (Number.isNaN(startsAtMs)) {
      throw new Error('startsAt must be a valid ISO datetime')
    }
    const now = new Date().toISOString()
    const scheduled: ScheduledRide = {
      schemaVersion: STORE_SCHEMA_VERSION,
      id: randomUUID(),
      workoutId: input.workoutId,
      startsAt: new Date(startsAtMs).toISOString(),
      createdAt: now,
    }
    await this.writeJson(join(this.scheduledDir, `${scheduled.id}.json`), scheduled)
    return scheduled
  }

  async listScheduledRides(
    query: ListScheduledRidesQuery = {},
  ): Promise<ScheduledRide[]> {
    const sinceMs = query.since ? Date.parse(query.since) : null
    const untilMs = query.until ? Date.parse(query.until) : null
    if (sinceMs !== null && Number.isNaN(sinceMs)) {
      throw new Error('Invalid since timestamp')
    }
    if (untilMs !== null && Number.isNaN(untilMs)) {
      throw new Error('Invalid until timestamp')
    }

    const files = await this.listJsonFiles(this.scheduledDir)
    const rides: ScheduledRide[] = []
    for (const file of files) {
      const ride = await this.readJson<ScheduledRide>(join(this.scheduledDir, file))
      const starts = Date.parse(ride.startsAt)
      if (Number.isNaN(starts)) continue
      if (sinceMs !== null && starts < sinceMs) continue
      if (untilMs !== null && starts > untilMs) continue
      rides.push(ride)
    }
    return rides.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  }

  async deleteScheduledRide(id: string): Promise<boolean> {
    const path = join(this.scheduledDir, `${id}.json`)
    let ride: ScheduledRide
    try {
      ride = await this.readJson<ScheduledRide>(path)
    } catch {
      return false
    }
    await unlink(path)
    await this.deleteWorkoutIfOrphaned(ride.workoutId)
    return true
  }

  async clearScheduledRides(query: {
    since: string
    until: string
  }): Promise<number> {
    const rides = await this.listScheduledRides(query)
    let deleted = 0
    for (const ride of rides) {
      if (await this.deleteScheduledRide(ride.id)) deleted++
    }
    return deleted
  }

  async deleteWorkout(id: string): Promise<boolean> {
    const path = join(this.workoutsDir, `${id}.json`)
    try {
      await this.readJson<Workout>(path)
    } catch {
      return false
    }
    await unlink(path)
    return true
  }

  /** Drop a Workout with no remaining Scheduled Rides and no Activities. */
  private async deleteWorkoutIfOrphaned(workoutId: string): Promise<void> {
    const remainingRides = await this.listScheduledRides()
    if (remainingRides.some((r) => r.workoutId === workoutId)) return

    const activities = await this.listActivities({})
    if (activities.some((a) => a.workoutId === workoutId)) return

    await this.deleteWorkout(workoutId)
  }

  private resolveBounds(query: ListActivitiesQuery): {
    sinceMs: number | null
    untilMs: number | null
  } {
    let sinceMs = query.since ? Date.parse(query.since) : null
    let untilMs = query.until ? Date.parse(query.until) : null

    if (query.pastDays !== undefined) {
      if (!Number.isFinite(query.pastDays) || query.pastDays < 0) {
        throw new Error('pastDays must be a non-negative number')
      }
      const fromPast = Date.now() - query.pastDays * 24 * 60 * 60 * 1000
      sinceMs = sinceMs === null ? fromPast : Math.max(sinceMs, fromPast)
    }

    if (sinceMs !== null && Number.isNaN(sinceMs)) {
      throw new Error('Invalid since timestamp')
    }
    if (untilMs !== null && Number.isNaN(untilMs)) {
      throw new Error('Invalid until timestamp')
    }

    return { sinceMs, untilMs }
  }

  private assertWorkoutInput(input: CreateWorkoutInput): void {
    if (!input.name?.trim()) {
      throw new Error('Workout name is required')
    }
    if (!Array.isArray(input.steps) || input.steps.length === 0) {
      throw new Error('Workout must have at least one step')
    }
    for (const step of input.steps) {
      this.assertStep(step)
    }
  }

  private assertStep(step: WorkoutStep): void {
    if (!STEP_TYPES.includes(step.type)) {
      throw new Error(`Invalid step type: ${String(step.type)}`)
    }
    if (!Number.isFinite(step.durationSec) || step.durationSec <= 0) {
      throw new Error('Step durationSec must be a positive number')
    }
    assertStepPrescription(normalizeStep(step))
  }

  private async listJsonFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir)
    return entries.filter((name) => name.endsWith('.json'))
  }

  private async readJson<T>(path: string): Promise<T> {
    const raw = await readFile(path, 'utf8')
    return JSON.parse(raw) as T
  }

  private async writeJson(path: string, value: unknown): Promise<void> {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  }
}
