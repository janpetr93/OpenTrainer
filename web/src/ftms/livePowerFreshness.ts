export const STALE_POWER_MS = 2000

export type LivePowerStatus = 'missing' | 'fresh' | 'stale'

export function livePowerStatus(input: {
  lastSampleAtMs: number | null
  nowMs: number
  watts: number | null
}): LivePowerStatus {
  if (input.lastSampleAtMs === null || input.watts === null) {
    return 'missing'
  }
  if (input.nowMs - input.lastSampleAtMs >= STALE_POWER_MS) {
    return 'stale'
  }
  return 'fresh'
}
