import type { IncomingMessage, ServerResponse } from 'node:http'
import type { LocalStore, SaveActivityInput } from '../store/localStore.js'
import type { PowerZoneId } from '../domain/cogganZones.js'
import type {
  CreateScheduledRideInput,
  CreateWorkoutInput,
  PowerProfilePoint,
  WorkoutStepType,
} from '../domain/types.js'
import type { StravaConfig } from '../strava/config.js'
import type { StravaFetch } from '../strava/client.js'
import { StravaLinkService } from '../strava/service.js'

export type CreateAppOptions = {
  stravaConfig?: StravaConfig | null
  companionOrigin?: string
  webOrigin?: string
  fetchImpl?: StravaFetch
}

function sendRedirect(res: ServerResponse, location: string): void {
  res.writeHead(302, {
    Location: location,
    'Access-Control-Allow-Origin': '*',
  })
  res.end()
}

const STEP_TYPES = new Set<WorkoutStepType>([
  'warmup',
  'steady',
  'recovery',
  'cooldown',
])

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(payload)
}

function sendText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(body)
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw.trim()) return null
  return JSON.parse(raw) as unknown
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
    if (typeof p.tSec !== 'number' || typeof p.watts !== 'number') {
      throw new Error(`${field}[${index}] needs numeric tSec and watts`)
    }
    const parsed: PowerProfilePoint = { tSec: p.tSec, watts: p.watts }
    const hrBpm = optionalMetric(p.hrBpm, field, index, 'hrBpm')
    const cadenceRpm = optionalMetric(p.cadenceRpm, field, index, 'cadenceRpm')
    const meterWatts = optionalMetric(p.meterWatts, field, index, 'meterWatts')
    if (hrBpm !== undefined) parsed.hrBpm = hrBpm
    if (cadenceRpm !== undefined) parsed.cadenceRpm = cadenceRpm
    if (meterWatts !== undefined) parsed.meterWatts = meterWatts
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
  if (typeof record.durationSec !== 'number') {
    throw new Error('durationSec must be a number')
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
  const plannedPowerProfile =
    record.plannedPowerProfile === undefined || record.plannedPowerProfile === null
      ? null
      : parseProfilePoints(record.plannedPowerProfile, 'plannedPowerProfile')

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
    workoutId,
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
    steps: steps.map((step, index) => {
      if (!step || typeof step !== 'object') {
        throw new Error(`steps[${index}] must be an object`)
      }
      const s = step as Record<string, unknown>
      const type = s.type
      if (typeof type !== 'string' || !STEP_TYPES.has(type as WorkoutStepType)) {
        throw new Error(`steps[${index}].type is invalid`)
      }
      if (typeof s.durationSec !== 'number') {
        throw new Error(`steps[${index}].durationSec must be a number`)
      }
      const targetWatts =
        s.targetWatts === undefined || s.targetWatts === null
          ? null
          : s.targetWatts
      if (targetWatts !== null && typeof targetWatts !== 'number') {
        throw new Error(`steps[${index}].targetWatts must be a number or null`)
      }
      const percentFtp =
        s.percentFtp === undefined || s.percentFtp === null ? null : s.percentFtp
      if (percentFtp !== null && typeof percentFtp !== 'number') {
        throw new Error(`steps[${index}].percentFtp must be a number or null`)
      }
      const zone = s.zone === undefined || s.zone === null ? null : s.zone
      if (zone !== null && typeof zone !== 'number') {
        throw new Error(`steps[${index}].zone must be 1–7 or null`)
      }
      return {
        type: type as WorkoutStepType,
        durationSec: s.durationSec,
        targetWatts,
        percentFtp,
        zone: zone as PowerZoneId | null,
      }
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
  })

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const method = req.method ?? 'GET'
    const url = new URL(req.url ?? '/', 'http://localhost')

    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      })
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
        const force = record.force === true
        const result = await strava.uploadActivity({
          activityId: record.activityId,
          fitBase64: record.fitBase64,
          name,
          force,
        })
        sendJson(res, 201, result)
        return
      }

      if (method === 'GET' && url.pathname === '/api/profile') {
        sendJson(res, 200, { profile: await store.getRiderProfile() })
        return
      }

      if (method === 'PUT' && url.pathname === '/api/profile') {
        const body = await readJsonBody(req)
        if (!body || typeof body !== 'object') {
          throw new Error('JSON body required')
        }
        const ftpWatts = (body as Record<string, unknown>).ftpWatts
        if (typeof ftpWatts !== 'number') {
          throw new Error('ftpWatts must be a number')
        }
        sendJson(res, 200, { profile: await store.setFtp(ftpWatts) })
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

      if (method === 'GET' && url.pathname === '/api/scheduled-rides') {
        const since = url.searchParams.get('since') ?? undefined
        const until = url.searchParams.get('until') ?? undefined
        const scheduledRides = await store.listScheduledRides({ since, until })
        sendJson(res, 200, { scheduledRides })
        return
      }

      if (method === 'POST' && url.pathname === '/api/scheduled-rides') {
        const body = await readJsonBody(req)
        const input = parseCreateScheduledRide(body)
        const scheduledRide = await store.createScheduledRide(input)
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
        sendJson(res, 200, { deleted })
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
        sendJson(res, 200, { ok: true })
        return
      }

      sendText(res, 404, 'Not found')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      sendJson(res, 400, { error: message })
    }
  }
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
  return { workoutId: record.workoutId, startsAt: record.startsAt }
}
