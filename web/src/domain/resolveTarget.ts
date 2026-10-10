import type { WorkoutStep } from '../api'
import { zonesFromFtp, type PowerZoneId } from './cogganZones'

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

export function stepNeedsFtp(step: WorkoutStep): boolean {
  const hasWatts = step.targetWatts !== null && step.targetWatts !== undefined
  if (hasWatts) return false
  const hasPct = step.percentFtp !== null && step.percentFtp !== undefined
  const hasZone = step.zone !== null && step.zone !== undefined
  return hasPct || hasZone
}

export function workoutNeedsFtp(steps: WorkoutStep[]): boolean {
  return steps.some(stepNeedsFtp)
}

export function assertStepPrescription(step: WorkoutStep): void {
  const hasPct = step.percentFtp !== null && step.percentFtp !== undefined
  const hasZone = step.zone !== null && step.zone !== undefined
  if (hasPct && (step.percentFtp! < 0 || step.percentFtp! > 300)) {
    throw new Error('percentFtp must be between 0 and 300')
  }
  if (hasZone) {
    const z = step.zone as PowerZoneId
    if (z < 1 || z > 7) throw new Error('zone must be 1–7')
  }
  if (
    step.targetWatts !== null &&
    step.targetWatts !== undefined &&
    step.targetWatts < 0
  ) {
    throw new Error('targetWatts must be non-negative')
  }
}
