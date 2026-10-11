import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { PowerZoneId } from '../domain/cogganZones.js'
import { zonesFromFtp } from '../domain/cogganZones.js'
import { buildPlannedPowerProfile } from '../domain/plannedPowerProfile.js'
import { assertStepPrescription } from '../domain/resolveTarget.js'
import {
  computeMmpFromActivities,
  fingerprintsMatch,
  mmpFingerprint,
} from '../domain/meanMaximalPower.js'
import {
  hydrateScheduledRide,
  toScheduledRideView,
} from '../domain/scheduledRideOutcome.js'
import { computeAverageAlignmentDeltaWatts } from '../domain/powerAlignment.js'
import { computeSessionAdherence } from '../domain/sessionAdherence.js'
import { computeSessionLoad } from '../domain/sessionLoad.js'
import {
  STORE_SCHEMA_VERSION,
  type Activity,
  type ActivityStravaUpload,
  type CreateScheduledRideInput,
  type CreateWorkoutInput,
  type ErgCalibration,
  type ListActivitiesQuery,
  type ListScheduledRidesQuery,
  type MmpCache,
  type PowerSourceMode,
  type RiderProfile,
  type ScheduledRide,
  type ScheduledRideView,
  type StravaLink,
  type TrainingIntent,
  type Workout,
  type WorkoutStep,
  type WorkoutStepType,
} from '../domain/types.js'

const STEP_TYPES: WorkoutStepType[] = ['warmup', 'steady', 'recovery', 'cooldown']
const PROFILE_FILE = 'profile.json'
const STRAVA_LINK_FILE = 'strava-link.json'
const MMP_FILE = 'mmp.json'
const ERG_CALIBRATION_FILE = 'erg-calibration.json'

export type SaveActivityInput = Omit<
  Activity,
  | 'schemaVersion'
  | 'id'
  | 'createdAt'
  | 'purpose'
  | 'stravaUpload'
  | 'sessionLoad'
  | 'sessionAdherence'
  | 'averageAlignmentDeltaWatts'
  | 'scheduledRideId'
  | 'primaryPowerSource'
> & {
  purpose?: string | null
  scheduledRideId?: string | null
  stravaUpload?: ActivityStravaUpload | null
  primaryPowerSource?: PowerSourceMode | null
}

export type RiderProfileView = RiderProfile & {
  zones: ReturnType<typeof zonesFromFtp> | null
}

const PURPOSE_MAX_LEN = 500

function parseMaxHardDays(value: unknown): number | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !Number.isInteger(value)) return null
  if (value < 0 || value > 7) return null
  return value
}

function parseWeekday(value: unknown): number | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !Number.isInteger(value)) return null
  if (value < 0 || value > 6) return null
  return value
}

function requireMaxHardDays(value: unknown): number | null {
  if (value === undefined || value === null) return null
  const parsed = parseMaxHardDays(value)
  if (parsed === null) {
    throw new Error('maxHardDaysPerWeek must be an integer 0–7 or null')
  }
  return parsed
}

function requireWeekday(value: unknown): number | null {
  if (value === undefined || value === null) return null
  const parsed = parseWeekday(value)
  if (parsed === null) {
    throw new Error(
      'preferredLongRideWeekday must be an integer 0–6 (Sun–Sat) or null',
    )
  }
  return parsed
}

function normalizePurpose(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > PURPOSE_MAX_LEN) {
    throw new Error(`purpose must be at most ${PURPOSE_MAX_LEN} characters`)
  }
  return trimmed
}

function withPurposeField<T extends { purpose?: string | null }>(
  record: T,
): T & { purpose: string | null } {
  return { ...record, purpose: normalizePurpose(record.purpose) }
}

function needsActivityMetricsBackfill(raw: Activity): boolean {
  return !(
    'sessionLoad' in raw &&
    'sessionAdherence' in raw &&
    'averageAlignmentDeltaWatts' in raw
  )
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
  private readonly mmpPath: string
  private readonly ergCalibrationPath: string

  constructor(private readonly rootDir: string) {
    this.workoutsDir = join(rootDir, 'workouts')
    this.activitiesDir = join(rootDir, 'activities')
    this.scheduledDir = join(rootDir, 'scheduled')
    this.profilePath = join(rootDir, PROFILE_FILE)
    this.stravaLinkPath = join(rootDir, STRAVA_LINK_FILE)
    this.mmpPath = join(rootDir, MMP_FILE)
    this.ergCalibrationPath = join(rootDir, ERG_CALIBRATION_FILE)
  }

  async ensureReady(): Promise<void> {
    await mkdir(this.workoutsDir, { recursive: true })
    await mkdir(this.activitiesDir, { recursive: true })
    await mkdir(this.scheduledDir, { recursive: true })
  }

  async getRiderProfile(): Promise<RiderProfileView> {
    let raw: Partial<RiderProfile> & { ftpWatts?: number | null }
    try {
      raw = await this.readJson<Partial<RiderProfile>>(this.profilePath)
    } catch {
      raw = {
        schemaVersion: STORE_SCHEMA_VERSION,
        ftpWatts: null,
        intent: null,
        updatedAt: new Date(0).toISOString(),
      }
    }
    const profile = this.normalizeRiderProfile(raw)
    return {
      ...profile,
      zones:
        profile.ftpWatts !== null && profile.ftpWatts > 0
          ? zonesFromFtp(profile.ftpWatts)
          : null,
    }
  }

  async getErgCalibration(): Promise<ErgCalibration> {
    try {
      const raw = await this.readJson<Partial<ErgCalibration>>(
        this.ergCalibrationPath,
      )
      const scale =
        typeof raw.scale === 'number' &&
        Number.isFinite(raw.scale) &&
        raw.scale > 0
          ? raw.scale
          : 1
      const offsetWatts =
        typeof raw.offsetWatts === 'number' && Number.isFinite(raw.offsetWatts)
          ? raw.offsetWatts
          : 0
      return {
        schemaVersion: STORE_SCHEMA_VERSION,
        scale,
        offsetWatts,
        updatedAt:
          typeof raw.updatedAt === 'string'
            ? raw.updatedAt
            : new Date(0).toISOString(),
      }
    } catch {
      return {
        schemaVersion: STORE_SCHEMA_VERSION,
        scale: 1,
        offsetWatts: 0,
        updatedAt: new Date(0).toISOString(),
      }
    }
  }

  async saveErgCalibration(input: {
    scale: number
    offsetWatts: number
  }): Promise<ErgCalibration> {
    if (!Number.isFinite(input.scale) || input.scale <= 0) {
      throw new Error('scale must be a positive finite number')
    }
    if (!Number.isFinite(input.offsetWatts)) {
      throw new Error('offsetWatts must be a finite number')
    }
    const calibration: ErgCalibration = {
      schemaVersion: STORE_SCHEMA_VERSION,
      scale: input.scale,
      offsetWatts: input.offsetWatts,
      updatedAt: new Date().toISOString(),
    }
    await this.writeJson(this.ergCalibrationPath, calibration)
    return calibration
  }

  async setFtp(ftpWatts: number): Promise<RiderProfileView> {
    if (!Number.isFinite(ftpWatts) || ftpWatts <= 0 || ftpWatts > 2000) {
      throw new Error('ftpWatts must be a positive number (≤ 2000)')
    }
    const current = await this.getRiderProfile()
    const profile: RiderProfile = {
      schemaVersion: STORE_SCHEMA_VERSION,
      ftpWatts: Math.round(ftpWatts),
      intent: current.intent,
      updatedAt: new Date().toISOString(),
    }
    await this.writeJson(this.profilePath, profile)
    return this.getRiderProfile()
  }

  async setTrainingIntent(
    intent: TrainingIntent | null,
  ): Promise<RiderProfileView> {
    const current = await this.getRiderProfile()
    let nextIntent: TrainingIntent | null = null
    if (intent !== null) {
      const goal = intent.goal.trim()
      if (!goal) {
        throw new Error('Training Intent goal must be a non-empty string')
      }
      if (goal.length > 500) {
        throw new Error('Training Intent goal must be ≤ 500 characters')
      }
      const horizon =
        intent.horizon && intent.horizon.trim()
          ? intent.horizon.trim()
          : null
      const note =
        intent.note && intent.note.trim() ? intent.note.trim() : null
      if (horizon && horizon.length > 200) {
        throw new Error('Training Intent horizon must be ≤ 200 characters')
      }
      if (note && note.length > 1000) {
        throw new Error('Training Intent note must be ≤ 1000 characters')
      }
      const maxHardDaysPerWeek = requireMaxHardDays(intent.maxHardDaysPerWeek)
      const preferredLongRideWeekday = requireWeekday(
        intent.preferredLongRideWeekday,
      )
      const constraintsNote =
        intent.constraintsNote && intent.constraintsNote.trim()
          ? intent.constraintsNote.trim()
          : null
      if (constraintsNote && constraintsNote.length > 1000) {
        throw new Error(
          'Training Intent constraintsNote must be ≤ 1000 characters',
        )
      }
      nextIntent = {
        goal,
        horizon,
        note,
        maxHardDaysPerWeek,
        preferredLongRideWeekday,
        constraintsNote,
      }
    }
    const profile: RiderProfile = {
      schemaVersion: STORE_SCHEMA_VERSION,
      ftpWatts: current.ftpWatts,
      intent: nextIntent,
      updatedAt: new Date().toISOString(),
    }
    await this.writeJson(this.profilePath, profile)
    return this.getRiderProfile()
  }

  private normalizeRiderProfile(raw: Partial<RiderProfile>): RiderProfile {
    return {
      schemaVersion: STORE_SCHEMA_VERSION,
      ftpWatts:
        typeof raw.ftpWatts === 'number' && Number.isFinite(raw.ftpWatts)
          ? raw.ftpWatts
          : null,
      intent: this.normalizeIntent(raw.intent),
      updatedAt:
        typeof raw.updatedAt === 'string' && raw.updatedAt.length > 0
          ? raw.updatedAt
          : new Date(0).toISOString(),
    }
  }

  private normalizeIntent(raw: unknown): TrainingIntent | null {
    if (raw == null || typeof raw !== 'object') return null
    const obj = raw as Record<string, unknown>
    if (typeof obj.goal !== 'string') return null
    const goal = obj.goal.trim()
    if (!goal) return null
    return {
      goal,
      horizon:
        typeof obj.horizon === 'string' && obj.horizon.trim()
          ? obj.horizon.trim()
          : null,
      note:
        typeof obj.note === 'string' && obj.note.trim()
          ? obj.note.trim()
          : null,
      maxHardDaysPerWeek: parseMaxHardDays(obj.maxHardDaysPerWeek),
      preferredLongRideWeekday: parseWeekday(obj.preferredLongRideWeekday),
      constraintsNote:
        typeof obj.constraintsNote === 'string' && obj.constraintsNote.trim()
          ? obj.constraintsNote.trim()
          : null,
    }
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
    const profile = await this.getRiderProfile()
    const scheduledRideId = input.scheduledRideId ?? null
    if (scheduledRideId) {
      const ride = await this.getScheduledRide(scheduledRideId)
      if (!ride) {
        throw new Error(`Scheduled Ride not found: ${scheduledRideId}`)
      }
      if (ride.status === 'completed') {
        throw new Error(`Scheduled Ride already completed: ${scheduledRideId}`)
      }
    }
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
      scheduledRideId,
      purpose: normalizePurpose(input.purpose),
      sessionLoad: computeSessionLoad(
        input.achievedPowerProfile,
        profile.ftpWatts,
      ),
      sessionAdherence: computeSessionAdherence(
        input.achievedPowerProfile,
        input.plannedPowerProfile,
      ),
      averageAlignmentDeltaWatts: computeAverageAlignmentDeltaWatts(
        input.achievedPowerProfile,
      ),
      primaryPowerSource: input.primaryPowerSource ?? null,
      createdAt: now,
      stravaUpload: null,
    }
    await this.writeJson(join(this.activitiesDir, `${activity.id}.json`), activity)
    if (scheduledRideId) {
      await this.markScheduledRideCompleted(scheduledRideId, activity.id)
    }
    await this.recomputeMmp()
    return activity
  }

  async getActivity(id: string): Promise<Activity | null> {
    try {
      const raw = await this.readJson<Activity>(
        join(this.activitiesDir, `${id}.json`),
      )
      const profile = await this.getRiderProfile()
      return this.hydrateActivityMetrics(raw, profile.ftpWatts, true)
    } catch {
      return null
    }
  }

  /**
   * Persist Session Load / Adherence / Average Alignment Delta for Activities
   * that predate those fields. Safe to call on companion / MCP startup.
   */
  async backfillActivityMetrics(): Promise<number> {
    const profile = await this.getRiderProfile()
    const files = await this.listJsonFiles(this.activitiesDir)
    let updated = 0
    for (const file of files) {
      const raw = await this.readJson<Activity>(join(this.activitiesDir, file))
      if (!needsActivityMetricsBackfill(raw)) continue
      await this.hydrateActivityMetrics(raw, profile.ftpWatts, true)
      updated += 1
    }
    return updated
  }

  private async hydrateActivityMetrics(
    raw: Activity,
    ftpWatts: number | null,
    persist: boolean,
  ): Promise<Activity> {
    const base = withPurposeField(raw)
    const hasLoad = 'sessionLoad' in raw && 'sessionAdherence' in raw
    const hasAlignment = 'averageAlignmentDeltaWatts' in raw
    if (hasLoad && hasAlignment) {
      return {
        ...base,
        scheduledRideId: raw.scheduledRideId ?? null,
        sessionLoad: raw.sessionLoad ?? null,
        sessionAdherence: raw.sessionAdherence ?? null,
        averageAlignmentDeltaWatts: raw.averageAlignmentDeltaWatts ?? null,
      }
    }
    const next: Activity = {
      ...base,
      scheduledRideId: base.scheduledRideId ?? null,
      sessionLoad: hasLoad
        ? (raw.sessionLoad ?? null)
        : computeSessionLoad(base.achievedPowerProfile, ftpWatts),
      sessionAdherence: hasLoad
        ? (raw.sessionAdherence ?? null)
        : computeSessionAdherence(
            base.achievedPowerProfile,
            base.plannedPowerProfile,
          ),
      averageAlignmentDeltaWatts: hasAlignment
        ? (raw.averageAlignmentDeltaWatts ?? null)
        : computeAverageAlignmentDeltaWatts(base.achievedPowerProfile),
    }
    if (persist) {
      await this.writeJson(join(this.activitiesDir, `${next.id}.json`), next)
    }
    return next
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

  async getMmpCache(): Promise<MmpCache | null> {
    try {
      return await this.readJson<MmpCache>(this.mmpPath)
    } catch {
      return null
    }
  }

  async writeMmpCache(cache: MmpCache): Promise<MmpCache> {
    await this.writeJson(this.mmpPath, cache)
    return cache
  }

  /** All Activities fingerprint for MMP staleness (ignores list date filters). */
  async activityMmpFingerprint(): Promise<ReturnType<typeof mmpFingerprint>> {
    const activities = await this.listActivities({})
    return mmpFingerprint(activities)
  }

  async isMmpStale(cache: MmpCache | null): Promise<boolean> {
    if (!cache) return true
    const current = await this.activityMmpFingerprint()
    return !fingerprintsMatch(
      {
        activityCount: cache.activityCount,
        latestActivityId: cache.latestActivityId,
        latestCreatedAt: cache.latestCreatedAt,
      },
      current,
    )
  }

  /** Recompute Mean Maximal Power from all Activities and persist mmp.json. */
  async recomputeMmp(): Promise<MmpCache> {
    const activities = await this.listActivities({})
    const { points, fingerprint } = computeMmpFromActivities(activities)
    const cache: MmpCache = {
      schemaVersion: STORE_SCHEMA_VERSION,
      points,
      computedAt: new Date().toISOString(),
      activityCount: fingerprint.activityCount,
      latestActivityId: fingerprint.latestActivityId,
      latestCreatedAt: fingerprint.latestCreatedAt,
    }
    return this.writeMmpCache(cache)
  }

  async listActivities(query: ListActivitiesQuery = {}): Promise<Activity[]> {
    const { sinceMs, untilMs } = this.resolveBounds(query)
    const files = await this.listJsonFiles(this.activitiesDir)
    const profile = await this.getRiderProfile()
    const activities: Activity[] = []

    for (const file of files) {
      const raw = await this.readJson<Activity>(join(this.activitiesDir, file))
      const started = Date.parse(raw.startedAt)
      if (Number.isNaN(started)) continue
      if (sinceMs !== null && started < sinceMs) continue
      if (untilMs !== null && started > untilMs) continue
      activities.push(
        await this.hydrateActivityMetrics(raw, profile.ftpWatts, true),
      )
    }

    return activities.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }

  async createScheduledRide(
    input: CreateScheduledRideInput,
  ): Promise<ScheduledRideView> {
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
      purpose: normalizePurpose(input.purpose),
      status: 'planned',
      activityId: null,
      skipReason: null,
      createdAt: now,
    }
    await this.writeJson(join(this.scheduledDir, `${scheduled.id}.json`), scheduled)
    return toScheduledRideView(scheduled)
  }

  async getScheduledRide(id: string): Promise<ScheduledRide | null> {
    try {
      const raw = await this.readJson<ScheduledRide>(
        join(this.scheduledDir, `${id}.json`),
      )
      return hydrateScheduledRide(withPurposeField(raw))
    } catch {
      return null
    }
  }

  async listScheduledRides(
    query: ListScheduledRidesQuery = {},
  ): Promise<ScheduledRideView[]> {
    const sinceMs = query.since ? Date.parse(query.since) : null
    const untilMs = query.until ? Date.parse(query.until) : null
    if (sinceMs !== null && Number.isNaN(sinceMs)) {
      throw new Error('Invalid since timestamp')
    }
    if (untilMs !== null && Number.isNaN(untilMs)) {
      throw new Error('Invalid until timestamp')
    }

    const files = await this.listJsonFiles(this.scheduledDir)
    const rides: ScheduledRideView[] = []
    const nowMs = Date.now()
    for (const file of files) {
      const ride = hydrateScheduledRide(
        withPurposeField(
          await this.readJson<ScheduledRide>(join(this.scheduledDir, file)),
        ),
      )
      const starts = Date.parse(ride.startsAt)
      if (Number.isNaN(starts)) continue
      if (sinceMs !== null && starts < sinceMs) continue
      if (untilMs !== null && starts > untilMs) continue
      rides.push(toScheduledRideView(ride, nowMs))
    }
    return rides.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  }

  async markScheduledRideCompleted(
    id: string,
    activityId: string,
  ): Promise<ScheduledRideView> {
    const ride = await this.getScheduledRide(id)
    if (!ride) throw new Error(`Scheduled Ride not found: ${id}`)
    const next: ScheduledRide = {
      ...ride,
      status: 'completed',
      activityId,
      skipReason: null,
    }
    await this.writeJson(join(this.scheduledDir, `${id}.json`), next)
    return toScheduledRideView(next)
  }

  async skipScheduledRide(
    id: string,
    skipReason?: string | null,
  ): Promise<ScheduledRideView> {
    const ride = await this.getScheduledRide(id)
    if (!ride) throw new Error(`Scheduled Ride not found: ${id}`)
    if (ride.status === 'completed') {
      throw new Error(`Cannot skip a completed Scheduled Ride: ${id}`)
    }
    const next: ScheduledRide = {
      ...ride,
      status: 'skipped',
      skipReason: normalizePurpose(skipReason),
      activityId: null,
    }
    await this.writeJson(join(this.scheduledDir, `${id}.json`), next)
    return toScheduledRideView(next)
  }

  async rescheduleScheduledRide(
    id: string,
    startsAt: string,
  ): Promise<ScheduledRideView> {
    const ride = await this.getScheduledRide(id)
    if (!ride) throw new Error(`Scheduled Ride not found: ${id}`)
    if (ride.status === 'completed') {
      throw new Error(`Cannot reschedule a completed Scheduled Ride: ${id}`)
    }
    const startsAtMs = Date.parse(startsAt)
    if (Number.isNaN(startsAtMs)) {
      throw new Error('startsAt must be a valid ISO datetime')
    }
    const next: ScheduledRide = {
      ...ride,
      startsAt: new Date(startsAtMs).toISOString(),
      status: 'planned',
      skipReason: null,
      activityId: null,
    }
    await this.writeJson(join(this.scheduledDir, `${id}.json`), next)
    return toScheduledRideView(next)
  }

  async deleteScheduledRide(id: string): Promise<boolean> {
    const path = join(this.scheduledDir, `${id}.json`)
    let ride: ScheduledRide
    try {
      ride = hydrateScheduledRide(await this.readJson<ScheduledRide>(path))
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
