import type { ScannedPeripheral } from './cadenceCandidates.js'

export type CadenceHelperEvent =
  | { event: 'ready' }
  | ({ event: 'device' } & ScannedPeripheral)
  | { event: 'connected'; id: string; name: string }
  | { event: 'measurement'; bytes: number[] }
  | { event: 'disconnected' }
  | { event: 'error'; message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isByteArray(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'number' && Number.isInteger(item) && item >= 0 && item <= 255)
  )
}

/** One stdout line from the cadence helper. Null when the line is not an event. */
export function parseCadenceHelperEvent(line: string): CadenceHelperEvent | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return null
  }
  if (!isRecord(parsed) || typeof parsed.event !== 'string') return null

  switch (parsed.event) {
    case 'ready':
    case 'disconnected':
      return { event: parsed.event }
    case 'error':
      return typeof parsed.message === 'string' ? { event: 'error', message: parsed.message } : null
    case 'connected':
      if (typeof parsed.id !== 'string' || typeof parsed.name !== 'string') return null
      return { event: 'connected', id: parsed.id, name: parsed.name }
    case 'measurement':
      return isByteArray(parsed.bytes) ? { event: 'measurement', bytes: parsed.bytes } : null
    case 'device': {
      if (typeof parsed.id !== 'string' || typeof parsed.name !== 'string') return null
      if (typeof parsed.rssi !== 'number' || typeof parsed.connectable !== 'boolean') return null
      if (!isStringArray(parsed.services)) return null
      if (parsed.companyId !== null && typeof parsed.companyId !== 'number') return null
      return {
        event: 'device',
        id: parsed.id,
        name: parsed.name,
        rssi: parsed.rssi,
        connectable: parsed.connectable,
        services: parsed.services,
        companyId: parsed.companyId,
      }
    }
    default:
      return null
  }
}
