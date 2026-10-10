import { zonesFromFtp, type PowerZoneId } from './cogganZones.js'
import type { WorkoutStep } from './types.js'

/** Resolve a step Target Prescription to watts using current FTP. */
export function resolveStepWatts(
  step: WorkoutStep,
  ftpWatts: number | null,
): number | null {
  if (step.targetWatts !== null && step.targetWatts !== undefined) {
    return Math.round(step.targetWatts)
  }

  if (step.percentFtp !== null && step.percentFtp !== undefined) {
    if (ftpWatts === null) {
      throw new Error('FTP required to resolve percentFtp targets')
    }
    return Math.round((step.percentFtp / 100) * ftpWatts)
  }

  if (step.zone !== null && step.zone !== undefined) {
    if (ftpWatts === null) {
      throw new Error('FTP required to resolve zone targets')
    }
    const zone = zonesFromFtp(ftpWatts).find((z) => z.zone === step.zone)
    if (!zone) {
      throw new Error(`Invalid zone: ${String(step.zone)}`)
    }
    return zone.targetWatts
  }

  return null
}

export function assertStepPrescription(step: WorkoutStep): void {
  const hasWatts = step.targetWatts !== null && step.targetWatts !== undefined
  const hasPct = step.percentFtp !== null && step.percentFtp !== undefined
  const hasZone = step.zone !== null && step.zone !== undefined
  // All null is allowed (free-spin step).
  if (hasPct && (step.percentFtp! < 0 || step.percentFtp! > 300)) {
    throw new Error('percentFtp must be between 0 and 300')
  }
  if (hasZone) {
    const z = step.zone as PowerZoneId
    if (z < 1 || z > 7) throw new Error('zone must be 1–7')
  }
  if (hasWatts && step.targetWatts! < 0) {
    throw new Error('targetWatts must be non-negative')
  }
}
