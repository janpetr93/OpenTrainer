import type { IncomingMessage, ServerResponse } from 'node:http'
import type { LocalStore, SaveActivityInput } from '../store/localStore.js'
import type { PowerZoneId } from '../domain/cogganZones.js'
import { loadMmpView } from '../domain/mmpView.js'
import type {
  CreateScheduledRideInput,
  CreateWorkoutInput,
  PowerProfilePoint,
  WorkoutItem,
  WorkoutStep,
  WorkoutStepType,
} from '../domain/types.js'
import { parseInProgressRide } from '../domain/inProgressRide.js'
import type { StravaConfig } from '../strava/config.js'
import type { StravaFetch } from '../strava/client.js'
import { StravaLinkService } from '../strava/service.js'
import type { GoogleCalendarConfig } from '../googleCalendar/config.js'
import { CalendarMirror } from '../googleCalendar/service.js'
import { BadRequestError, UpstreamError } from '../errors.js'

export { BadRequestError, UpstreamError }

export type CreateAppOptions = {
  stravaConfig?: StravaConfig | null
  googleCalendarConfig?: GoogleCalendarConfig | null
  companionOrigin?: string
  webOrigin?: string
  fetchImpl?: StravaFetch
  /** Desktop only. Stamps the return URL after OAuth state is accepted. */
  issueOAuthHandoff?: () => string
}


const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]'])

/** Request bodies are JSON; the largest is a FIT upload in base64. */
const MAX_BODY_BYTES = 25 * 1024 * 1024

function hostnameOf(value: string): string | null {
  try {
    return new URL(value).hostname
  } catch {
    return null
  }
}

/**
 * The companion holds the rider's data and Strava / Google tokens, so only the
 * app itself may call it. The UI is same-origin (Vite proxy in development,
 * the desktop server when packaged), so no CORS headers are sent: a page on
 * another site cannot read responses or pass a preflight. The checks below
 * also stop simple cross-site requests and DNS rebinding: the Host must be a
 * loopback name, and a browser-sent Origin must be loopback too.
 */
export function isAllowedRequest(req: IncomingMessage): boolean {
  const host = req.headers.host
  if (!host || !LOOPBACK_HOSTS.has(hostnameOf(`http://${host}`) ?? '')) {
    return false
  }
  const origin = req.headers.origin
  if (origin === undefined) return true
  return LOOPBACK_HOSTS.has(hostnameOf(origin) ?? '')
}

/** Status for an error: 400 for client mistakes, 502 for Strava / Google, 500 otherwise. */
export function statusForError(error: unknown): number {
  if (error instanceof BadRequestError) return 400
  if (error instanceof UpstreamError) return 502
  if (error instanceof SyntaxError) return 500 // a stored file, not the body
  if (error instanceof TypeError) {
    // fetch() reports an unreachable Strava / Google as TypeError('fetch failed');
    // any other TypeError is a bug here.
    return error.message === 'fetch failed' ? 502 : 500
  }
  if (error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string') {
    return 500 // filesystem: EACCES, ENOSPC, EISDIR, …
  }
  // Validation in the store and services throws plain Errors with a message
  // for the rider ("Workout not found", "startsAt must be …").
  return 400
}

function sendRedirect(res: ServerResponse, location: string): void {
  res.writeHead(302, { Location: location })
  res.end()
}

const STEP_TYPES = new Set<WorkoutStepType>([
  'warmup',
  'steady',
  'recovery',
  'cooldown',
  'open',
])

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(payload)
}

function sendText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(body)
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_BODY_BYTES) {
      throw new BadRequestError('Request body is too large')
    }
    chunks.push(buffer)
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw.trim()) return null
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new BadRequestError('Request body is not valid JSON')
  }
}

function optionalMetric(
  value: unknown,
  field: string,
  index: number,
  key: string,
): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field}[${index}].${key} must be a number or null`)
  }
  return value
}

function parseProfilePoints(value: unknown, field: string): PowerProfilePoint[] {
  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`)
  }
  return value.map((point, index) => {
    if (!point || typeof point !== 'object') {
      throw new Error(`${field}[${index}] must be an object`)
    }
    const p = point as Record<string, unknown>
    if (
      typeof p.tSec !== 'number' ||
      !Number.isFinite(p.tSec) ||
      p.tSec < 0 ||
      (p.watts !== null && (typeof p.watts !== 'number' || !Number.isFinite(p.watts)))
    ) {
      throw new Error(`${field}[${index}] needs numeric tSec and watts or null`)
    }
    const parsed: PowerProfilePoint = {
      tSec: p.tSec,
      watts: p.watts === null ? null : p.watts,
    }
    const hrBpm = optionalMetric(p.hrBpm, field, index, 'hrBpm')
    const cadenceRpm = optionalMetric(p.cadenceRpm, field, index, 'cadenceRpm')
    const meterWatts = optionalMetric(p.meterWatts, field, index, 'meterWatts')
    const trainerWatts = optionalMetric(
      p.trainerWatts,
      field,
      index,
      'trainerWatts',
    )
    if (hrBpm !== undefined) parsed.hrBpm = hrBpm
    if (cadenceRpm !== undefined) parsed.cadenceRpm = cadenceRpm
    if (meterWatts !== undefined) parsed.meterWatts = meterWatts
    if (trainerWatts !== undefined) parsed.trainerWatts = trainerWatts
    return parsed
  })
}

function parseSaveActivity(body: unknown): SaveActivityInput {
  if (!body || typeof body !== 'object') {
    throw new Error('JSON body required')
  }
  const record = body as Record<string, unknown>
  if (typeof record.startedAt !== 'string') {
    throw new Error('startedAt must be an ISO string')
  }
  if (
    typeof record.durationSec !== 'number' ||
    !Number.isFinite(record.durationSec) ||
    record.durationSec < 0
  ) {
    throw new Error('durationSec must be a non-negative number')
  }
  const averagePowerWatts =
    record.averagePowerWatts === undefined || record.averagePowerWatts === null
      ? null
      : record.averagePowerWatts
  const maxPowerWatts =
    record.maxPowerWatts === undefined || record.maxPowerWatts === null
      ? null
      : record.maxPowerWatts
  if (averagePowerWatts !== null && typeof averagePowerWatts !== 'number') {
    throw new Error('averagePowerWatts must be a number or null')
  }
  if (maxPowerWatts !== null && typeof maxPowerWatts !== 'number') {
    throw new Error('maxPowerWatts must be a number or null')
  }
  const workoutId =
    record.workoutId === undefined || record.workoutId === null
      ? null
      : record.workoutId
  if (workoutId !== null && typeof workoutId !== 'string') {
    throw new Error('workoutId must be a string or null')
  }
  const purpose = parseOptionalPurpose(record.purpose)
  const scheduledRideId =
    record.scheduledRideId === undefined || record.scheduledRideId === null
      ? null
      : record.scheduledRideId
  if (scheduledRideId !== null && typeof scheduledRideId !== 'string') {
    throw new Error('scheduledRideId must be a string or null')
  }
  const plannedPowerProfile =
    record.plannedPowerProfile === undefined || record.plannedPowerProfile === null
      ? null
      : parseProfilePoints(record.plannedPowerProfile, 'plannedPowerProfile')
  const targetPowerProfile =
    record.targetPowerProfile === undefined || record.targetPowerProfile === null
      ? null
      : parseProfilePoints(record.targetPowerProfile, 'targetPowerProfile')
  const freeRideFromSec =
    record.freeRideFromSec === undefined || record.freeRideFromSec === null
      ? null
      : record.freeRideFromSec
  if (
    freeRideFromSec !== null &&
    (typeof freeRideFromSec !== 'number' ||
      !Number.isFinite(freeRideFromSec) ||
      freeRideFromSec < 0)
  ) {
    throw new Error('freeRideFromSec must be a non-negative number or null')
  }

  const primaryPowerSource =
    record.primaryPowerSource === undefined || record.primaryPowerSource === null
      ? null
      : record.primaryPowerSource
  if (
    primaryPowerSource !== null &&
    primaryPowerSource !== 'meter' &&
    primaryPowerSource !== 'trainer'
  ) {
    throw new Error('primaryPowerSource must be "meter", "trainer", or null')
  }

  return {
    startedAt: record.startedAt,
    durationSec: record.durationSec,
    averagePowerWatts,
    maxPowerWatts,
    achievedPowerProfile: parseProfilePoints(
      record.achievedPowerProfile,
      'achievedPowerProfile',
    ),
    plannedPowerProfile,
    targetPowerProfile,
    freeRideFromSec,
    workoutId,
    scheduledRideId,
    purpose,
    primaryPowerSource,
  }
}

function parseCreateWorkout(body: unknown): CreateWorkoutInput {
  if (!body || typeof body !== 'object') {
    throw new Error('JSON body required')
  }
  const record = body as Record<string, unknown>
  const name = record.name
  const steps = record.steps
  if (typeof name !== 'string') throw new Error('name must be a string')
  if (!Array.isArray(steps)) throw new Error('steps must be an array')

  return {
    name,
    steps: steps.map((step, index) => parseWorkoutItem(step, index)),
  }
}

function parseWorkoutStep(
  step: unknown,
  label: string,
): WorkoutStep {
  if (!step || typeof step !== 'object') {
    throw new Error(`${label} must be an object`)
  }
  const s = step as Record<string, unknown>
  const type = s.type
  if (typeof type !== 'string' || !STEP_TYPES.has(type as WorkoutStepType)) {
    throw new Error(`${label}.type is invalid`)
  }
  if (typeof s.durationSec !== 'number') {
    throw new Error(`${label}.durationSec must be a number`)
  }
  const targetWatts =
    s.targetWatts === undefined || s.targetWatts === null ? null : s.targetWatts
  if (targetWatts !== null && typeof targetWatts !== 'number') {
    throw new Error(`${label}.targetWatts must be a number or null`)
  }
  const percentFtp =
    s.percentFtp === undefined || s.percentFtp === null ? null : s.percentFtp
  if (percentFtp !== null && typeof percentFtp !== 'number') {
    throw new Error(`${label}.percentFtp must be a number or null`)
  }
  const zone = s.zone === undefined || s.zone === null ? null : s.zone
  if (
    zone !== null &&
    (typeof zone !== 'number' || !Number.isInteger(zone) || zone < 1 || zone > 7)
  ) {
    throw new Error(`${label}.zone must be 1–7 or null`)
  }
  return {
    type: type as WorkoutStepType,
    durationSec: s.durationSec,
    targetWatts,
    percentFtp,
    zone: zone as PowerZoneId | null,
  }
}

function parseWorkoutItem(step: unknown, index: number): WorkoutItem {
  if (!step || typeof step !== 'object') {
    throw new Error(`steps[${index}] must be an object`)
  }
  const s = step as Record<string, unknown>
  if (s.type !== 'repeat') return parseWorkoutStep(step, `steps[${index}]`)
  if (typeof s.count !== 'number' || !Number.isInteger(s.count)) {
    throw new Error(`steps[${index}].count must be an integer`)
  }
  if (!Array.isArray(s.steps)) {
    throw new Error(`steps[${index}].steps must be an array`)
  }
  return {
    type: 'repeat',
    count: s.count,
    steps: s.steps.map((inner, innerIndex) => {
      if (
        inner &&
        typeof inner === 'object' &&
        (inner as Record<string, unknown>).type === 'repeat'
      ) {
        throw new Error(`steps[${index}] cannot nest a Workout Repeat`)
      }
      return parseWorkoutStep(inner, `steps[${index}].steps[${innerIndex}]`)
    }),
  }
}

export function createRequestHandler(
  store: LocalStore,
  options: CreateAppOptions = {},
) {
  const companionOrigin =
    options.companionOrigin ?? 'http://127.0.0.1:8787'
  const webOrigin = options.webOrigin ?? 'http://127.0.0.1:5173'
  const stravaConfig =
    options.stravaConfig === undefined ? null : options.stravaConfig
  const strava = new StravaLinkService({
    store,
    config: stravaConfig,
    companionOrigin,
    webOrigin,
    fetchImpl: options.fetchImpl,
    issueOAuthHandoff: options.issueOAuthHandoff,
  })
  const googleCalendarConfig =
    options.googleCalendarConfig === undefined
      ? null
      : options.googleCalendarConfig
  const calendarMirror = new CalendarMirror({
    store,
    config: googleCalendarConfig,
    companionOrigin,
    webOrigin,
    fetchImpl: options.fetchImpl,
    issueOAuthHandoff: options.issueOAuthHandoff,
  })

  /** Scheduled Ride writes have landed by now; a mirror failure must not report them as failed. */
  const reconcileQuietly = async (): Promise<void> => {
    try {
      await calendarMirror.reconcile()
    } catch (error) {
      console.error('Calendar Mirror reconcile failed:', error)
    }
  }

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const method = req.method ?? 'GET'
    const url = new URL(req.url ?? '/', 'http://localhost')

    if (!isAllowedRequest(req)) {
      sendJson(res, 403, { error: 'Requests must come from the OpenTrainer app' })
      return
    }

    if (method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    try {
      if (method === 'GET' && url.pathname === '/api/health') {
        sendJson(res, 200, { ok: true })
        return
      }

      if (method === 'GET' && url.pathname === '/api/strava/status') {
        sendJson(res, 200, await strava.getStatus())
        return
      }

      if (method === 'GET' && url.pathname === '/api/strava/authorize') {
        const { url: authorizeUrl } = strava.beginAuthorize()
        sendRedirect(res, authorizeUrl)
        return
      }

      if (method === 'GET' && url.pathname === '/api/strava/callback') {
        const location = await strava.completeOAuth({
          code: url.searchParams.get('code'),
          state: url.searchParams.get('state'),
          scope: url.searchParams.get('scope'),
          error: url.searchParams.get('error'),
        })
        sendRedirect(res, location)
        return
      }

      if (method === 'POST' && url.pathname === '/api/strava/disconnect') {
        await strava.disconnect()
        sendJson(res, 200, { ok: true })
        return
      }

      if (method === 'GET' && url.pathname === '/api/google-calendar/status') {
        sendJson(res, 200, await calendarMirror.getStatus())
        return
      }

      if (method === 'GET' && url.pathname === '/api/google-calendar/authorize') {
        const { url: authorizeUrl } = calendarMirror.beginAuthorize()
        sendRedirect(res, authorizeUrl)
        return
      }

      if (method === 'GET' && url.pathname === '/api/google-calendar/callback') {
        const location = await calendarMirror.completeOAuth({
          code: url.searchParams.get('code'),
          state: url.searchParams.get('state'),
          scope: url.searchParams.get('scope'),
          error: url.searchParams.get('error'),
        })
        sendRedirect(res, location)
        return
      }

      if (method === 'POST' && url.pathname === '/api/google-calendar/disconnect') {
        await calendarMirror.disconnect()
        sendJson(res, 200, { ok: true })
        return
      }

      if (method === 'POST' && url.pathname === '/api/strava/upload') {
        const body = await readJsonBody(req)
        if (!body || typeof body !== 'object') {
          throw new Error('JSON body required')
        }
        const record = body as Record<string, unknown>
        if (typeof record.activityId !== 'string') {
          throw new Error('activityId must be a string')
        }
        if (typeof record.fitBase64 !== 'string') {
          throw new Error('fitBase64 must be a string')
        }
        const name =
          record.name === undefined || record.name === null
            ? undefined
            : record.name
        if (name !== undefined && typeof name !== 'string') {
          throw new Error('name must be a string')
        }
        const description =
          record.description === undefined || record.description === null
            ? undefined
            : record.description
        if (description !== undefined && typeof description !== 'string') {
          throw new Error('description must be a string')
        }
        const force = record.force === true
        const result = await strava.uploadActivity({
          activityId: record.activityId,
          fitBase64: record.fitBase64,
          name,
          description,
          force,
        })
        sendJson(res, 201, result)
        return
      }

      if (method === 'GET' && url.pathname === '/api/profile') {
        sendJson(res, 200, { profile: await store.getRiderProfile() })
        return
      }

      if (method === 'GET' && url.pathname === '/api/erg-calibration') {
        sendJson(res, 200, {
          calibration: await store.getErgCalibration(),
        })
        return
      }

      if (method === 'PUT' && url.pathname === '/api/erg-calibration') {
        const body = await readJsonBody(req)
        if (!body || typeof body !== 'object') {
          throw new Error('JSON body required')
        }
        const record = body as Record<string, unknown>
        if (typeof record.scale !== 'number' || !Number.isFinite(record.scale)) {
          throw new Error('scale must be a finite number')
        }
        if (
          typeof record.offsetWatts !== 'number' ||
          !Number.isFinite(record.offsetWatts)
        ) {
          throw new Error('offsetWatts must be a finite number')
        }
        const calibration = await store.saveErgCalibration({
          scale: record.scale,
          offsetWatts: record.offsetWatts,
        })
        sendJson(res, 200, { calibration })
        return
      }

      if (method === 'GET' && url.pathname === '/api/mmp') {
        sendJson(res, 200, { mmp: await loadMmpView(store) })
        return
      }

      if (method === 'POST' && url.pathname === '/api/mmp/recompute') {
        await store.recomputeMmp()
        sendJson(res, 200, { mmp: await loadMmpView(store) })
        return
      }

      if (method === 'GET' && url.pathname === '/api/workouts') {
        sendJson(res, 200, { workouts: await store.listWorkouts() })
        return
      }

      if (method === 'POST' && url.pathname === '/api/workouts') {
        const body = await readJsonBody(req)
        const input = parseCreateWorkout(body)
        const workout = await store.createWorkout(input)
        sendJson(res, 201, { workout })
        return
      }

      if (method === 'GET' && url.pathname === '/api/activities') {
        const pastDaysRaw = url.searchParams.get('pastDays')
        const since = url.searchParams.get('since') ?? undefined
        const until = url.searchParams.get('until') ?? undefined
        const pastDays =
          pastDaysRaw === null
            ? since || until
              ? undefined
              : 14
            : Number(pastDaysRaw)
        const activities = await store.listActivities({ pastDays, since, until })
        sendJson(res, 200, { activities })
        return
      }

      if (method === 'POST' && url.pathname === '/api/activities') {
        const body = await readJsonBody(req)
        const input = parseSaveActivity(body)
        const activity = await store.saveActivity(input)
        sendJson(res, 201, { activity })
        return
      }

      if (method === 'GET' && url.pathname === '/api/in-progress-ride') {
        sendJson(res, 200, { inProgressRide: await store.getInProgressRide() })
        return
      }

      if (method === 'PUT' && url.pathname === '/api/in-progress-ride') {
        const body = await readJsonBody(req)
        const inProgressRide = await store.saveInProgressRide(parseInProgressRide(body))
        sendJson(res, 200, { inProgressRide })
        return
      }

      if (method === 'DELETE' && url.pathname === '/api/in-progress-ride') {
        await store.clearInProgressRide()
        sendJson(res, 200, { ok: true })
        return
      }

      if (method === 'GET' && url.pathname === '/api/scheduled-rides') {
        const since = url.searchParams.get('since') ?? undefined
        const until = url.searchParams.get('until') ?? undefined
        const scheduledRides = await store.listScheduledRides({ since, until })
        sendJson(res, 200, { scheduledRides })
        return
      }

      if (method === 'GET' && url.pathname === '/api/blockers') {
        const since = url.searchParams.get('since') ?? undefined
        const until = url.searchParams.get('until') ?? undefined
        const blockers = await store.listBlockers({ since, until })
        sendJson(res, 200, { blockers })
        return
      }

      if (method === 'POST' && url.pathname === '/api/scheduled-rides') {
        const body = await readJsonBody(req)
        const input = parseCreateScheduledRide(body)
        const scheduledRide = await store.createScheduledRide(input)
        await reconcileQuietly()
        sendJson(res, 201, { scheduledRide })
        return
      }

      if (method === 'POST' && url.pathname === '/api/scheduled-rides/clear') {
        const body = await readJsonBody(req)
        if (!body || typeof body !== 'object') {
          throw new Error('JSON body required')
        }
        const record = body as Record<string, unknown>
        if (typeof record.since !== 'string' || typeof record.until !== 'string') {
          throw new Error('since and until ISO strings are required')
        }
        const deleted = await store.clearScheduledRides({
          since: record.since,
          until: record.until,
        })
        await reconcileQuietly()
        sendJson(res, 200, { deleted })
        return
      }

      const skipMatch = url.pathname.match(
        /^\/api\/scheduled-rides\/([^/]+)\/skip$/,
      )
      if (method === 'POST' && skipMatch) {
        const id = decodeURIComponent(skipMatch[1]!)
        const body = await readJsonBody(req)
        const reason =
          body && typeof body === 'object'
            ? parseOptionalString((body as Record<string, unknown>).reason, 'reason')
            : null
        const scheduledRide = await store.skipScheduledRide(id, reason)
        await reconcileQuietly()
        sendJson(res, 200, { scheduledRide })
        return
      }

      const rescheduleMatch = url.pathname.match(
        /^\/api\/scheduled-rides\/([^/]+)\/reschedule$/,
      )
      if (method === 'POST' && rescheduleMatch) {
        const id = decodeURIComponent(rescheduleMatch[1]!)
        const body = await readJsonBody(req)
        if (!body || typeof body !== 'object') {
          throw new Error('JSON body required')
        }
        const startsAt = (body as Record<string, unknown>).startsAt
        if (typeof startsAt !== 'string') {
          throw new Error('startsAt must be an ISO string')
        }
        const scheduledRide = await store.rescheduleScheduledRide(id, startsAt)
        await reconcileQuietly()
        sendJson(res, 200, { scheduledRide })
        return
      }

      const scheduledMatch = url.pathname.match(
        /^\/api\/scheduled-rides\/([^/]+)$/,
      )
      if (method === 'DELETE' && scheduledMatch) {
        const id = decodeURIComponent(scheduledMatch[1]!)
        const deleted = await store.deleteScheduledRide(id)
        if (!deleted) {
          sendJson(res, 404, { error: 'Scheduled Ride not found' })
          return
        }
        await reconcileQuietly()
        sendJson(res, 200, { ok: true })
        return
      }

      sendText(res, 404, 'Not found')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const status = statusForError(error)
      if (status >= 500) console.error(`${method} ${url.pathname} failed:`, error)
      if (res.headersSent) {
        res.end()
        return
      }
      sendJson(res, status, { error: message })
    }
  }
}

function parseOptionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string or null`)
  }
  return value
}

function parseOptionalPurpose(value: unknown): string | null {
  return parseOptionalString(value, 'purpose')
}

function parseCreateScheduledRide(body: unknown): CreateScheduledRideInput {
  if (!body || typeof body !== 'object') {
    throw new Error('JSON body required')
  }
  const record = body as Record<string, unknown>
  if (typeof record.workoutId !== 'string') {
    throw new Error('workoutId must be a string')
  }
  if (typeof record.startsAt !== 'string') {
    throw new Error('startsAt must be an ISO string')
  }
  return {
    workoutId: record.workoutId,
    startsAt: record.startsAt,
    purpose: parseOptionalPurpose(record.purpose),
  }
}
