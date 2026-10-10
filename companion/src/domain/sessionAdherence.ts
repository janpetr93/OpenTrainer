import { flattenWattSeries } from './sessionLoad.js'
import type { PowerProfilePoint } from './types.js'

export type SessionAdherence = {
  /** Achieved duration / planned duration, capped at 1. */
  completionRatio: number
  /** Fraction of overlapping seconds within the target band. */
  targetAdherence: number
}

/** On-target when |Δ| ≤ max(15% × planned, 20W). */
export function isWithinTargetBand(achievedWatts: number, plannedWatts: number): boolean {
  const band = Math.max(0.15 * plannedWatts, 20)
  return Math.abs(achievedWatts - plannedWatts) <= band
}

export function computeSessionAdherence(
  achievedPowerProfile: PowerProfilePoint[],
  plannedPowerProfile: PowerProfilePoint[] | null,
): SessionAdherence | null {
  if (!plannedPowerProfile || plannedPowerProfile.length === 0) {
    return null
  }

  const planned = flattenWattSeries(plannedPowerProfile)
  const achieved = flattenWattSeries(achievedPowerProfile)
  if (planned.length === 0) return null

  const completionRatio = Math.min(1, achieved.length / planned.length)

  const overlap = Math.min(planned.length, achieved.length)
  if (overlap === 0) {
    return { completionRatio, targetAdherence: 0 }
  }

  let onTarget = 0
  for (let i = 0; i < overlap; i++) {
    if (isWithinTargetBand(achieved[i]!, planned[i]!)) onTarget += 1
  }

  return {
    completionRatio: Math.round(completionRatio * 1000) / 1000,
    targetAdherence: Math.round((onTarget / overlap) * 1000) / 1000,
  }
}
