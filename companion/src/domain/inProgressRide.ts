import { STORE_SCHEMA_VERSION, type PowerProfilePoint, type PowerSourceMode } from './types.js'

/** One in-progress ride. Not an Activity until Stop. */
export const IN_PROGRESS_RIDE_FILE = 'in-progress-ride.json'

export type RideChange = { tSec: number; percent?: number; watts?: number }

export type InProgressRide = {
  schemaVersion: typeof STORE_SCHEMA_VERSION
  startedAt: string
  updatedAt: string
  elapsedSec: number
  durationSec: number
  averagePowerWatts: number | null
  maxPowerWatts: number | null
  achievedPowerProfile: PowerProfilePoint[]
  plannedPowerProfile: PowerProfilePoint[] | null
  targetPowerProfile: PowerProfilePoint[] | null
  freeRideFromSec: number | null
  workoutId: string | null
  scheduledRideId: string | null
  purpose: string | null
  primaryPowerSource: PowerSourceMode | null
  ftpWatts: number | null
  freeRide: boolean
  intensityPercent: number
  intensityChanges: { tSec: number; percent: number }[]
  freeRideTargetWatts: number | null
  freeRideTargetChanges: { tSec: number; watts: number }[]
}

const MAX_POINTS = 100_000

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

function parseProfile(value: unknown, field: string): PowerProfilePoint[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`)
  if (value.length > MAX_POINTS) throw new Error(`${field} is too long`)
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
    const trainerWatts = optionalMetric(p.trainerWatts, field, index, 'trainerWatts')
    if (hrBpm !== undefined) parsed.hrBpm = hrBpm
    if (cadenceRpm !== undefined) parsed.cadenceRpm = cadenceRpm
    if (meterWatts !== undefined) parsed.meterWatts = meterWatts
    if (trainerWatts !== undefined) parsed.trainerWatts = trainerWatts
    return parsed
  })
}

function parseNullableProfile(value: unknown, field: string): PowerProfilePoint[] | null {
  if (value === undefined || value === null) return null
  return parseProfile(value, field)
}

function parseNullableString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw new Error(`${field} must be a string or null`)
  return value
}

function parseNonNegative(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${field} must be a non-negative number`)
  }
  return value
}

function parseNullableNumber(value: unknown, field: string): number | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${field} must be a number or null`)
  }
  return value
}

function parseTimed(
  value: unknown,
  field: string,
  key: 'percent' | 'watts',
): { tSec: number; percent: number }[] | { tSec: number; watts: number }[] {
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`)
  return value.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`${field}[${index}] must be an object`)
    }
    const row = item as Record<string, unknown>
    return {
      tSec: parseNonNegative(row.tSec, `${field}[${index}].tSec`),
      [key]: parseNonNegative(row[key], `${field}[${index}].${key}`),
    }
  }) as { tSec: number; percent: number }[] | { tSec: number; watts: number }[]
}

/** Accept a checkpoint body. `updatedAt` is filled when the store writes it. */
export function parseInProgressRide(body: unknown): InProgressRide {
  if (!body || typeof body !== 'object') throw new Error('JSON body required')
  const record = body as Record<string, unknown>
  if (
    record.schemaVersion !== undefined &&
    record.schemaVersion !== STORE_SCHEMA_VERSION
  ) {
    throw new Error('schemaVersion is not supported')
  }
  if (typeof record.startedAt !== 'string' || !record.startedAt) {
    throw new Error('startedAt must be an ISO string')
  }
  if (typeof record.freeRide !== 'boolean') {
    throw new Error('freeRide must be a boolean')
  }
  const primaryPowerSource = parseNullableString(
    record.primaryPowerSource,
    'primaryPowerSource',
  )
  if (
    primaryPowerSource !== null &&
    primaryPowerSource !== 'meter' &&
    primaryPowerSource !== 'trainer'
  ) {
    throw new Error('primaryPowerSource must be "meter", "trainer", or null')
  }
  const purpose = parseNullableString(record.purpose, 'purpose')
  return {
    schemaVersion: STORE_SCHEMA_VERSION,
    startedAt: record.startedAt,
    updatedAt:
      typeof record.updatedAt === 'string'
        ? record.updatedAt
        : new Date(0).toISOString(),
    elapsedSec: parseNonNegative(record.elapsedSec, 'elapsedSec'),
    durationSec: parseNonNegative(record.durationSec, 'durationSec'),
    averagePowerWatts: parseNullableNumber(record.averagePowerWatts, 'averagePowerWatts'),
    maxPowerWatts: parseNullableNumber(record.maxPowerWatts, 'maxPowerWatts'),
    achievedPowerProfile: parseProfile(record.achievedPowerProfile, 'achievedPowerProfile'),
    plannedPowerProfile: parseNullableProfile(record.plannedPowerProfile, 'plannedPowerProfile'),
    targetPowerProfile: parseNullableProfile(record.targetPowerProfile, 'targetPowerProfile'),
    freeRideFromSec:
      record.freeRideFromSec === undefined || record.freeRideFromSec === null
        ? null
        : parseNonNegative(record.freeRideFromSec, 'freeRideFromSec'),
    workoutId: parseNullableString(record.workoutId, 'workoutId'),
    scheduledRideId: parseNullableString(record.scheduledRideId, 'scheduledRideId'),
    purpose: purpose === null ? null : purpose.slice(0, 500),
    primaryPowerSource,
    ftpWatts: parseNullableNumber(record.ftpWatts, 'ftpWatts'),
    freeRide: record.freeRide,
    intensityPercent: parseNonNegative(record.intensityPercent, 'intensityPercent'),
    intensityChanges: parseTimed(record.intensityChanges, 'intensityChanges', 'percent') as {
      tSec: number
      percent: number
    }[],
    freeRideTargetWatts: parseNullableNumber(
      record.freeRideTargetWatts,
      'freeRideTargetWatts',
    ),
    freeRideTargetChanges: parseTimed(
      record.freeRideTargetChanges,
      'freeRideTargetChanges',
      'watts',
    ) as { tSec: number; watts: number }[],
  }
}

/**
 * A checkpoint that is behind one already stored for the same ride.
 * A same-second rewrite (the last sample updated) is not behind.
 */
export function inProgressRideIsBehind(
  existing: InProgressRide,
  next: InProgressRide,
): boolean {
  if (existing.startedAt !== next.startedAt) return false
  if (next.elapsedSec < existing.elapsedSec) return true
  return (
    next.elapsedSec === existing.elapsedSec &&
    next.achievedPowerProfile.length < existing.achievedPowerProfile.length
  )
}
