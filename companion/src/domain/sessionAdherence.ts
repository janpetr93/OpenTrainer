import { flattenWattSeries } from './sessionLoad.js'
import type { PowerProfilePoint } from './types.js'

export type SessionAdherence = {
  /** Achieved duration / planned duration, capped at 1. */
  completionRatio: number
  /**
   * Fraction of overlapping seconds within the target band, scored against
   * the ridden targets when the rider changed Ride Intensity.
   */
  targetAdherence: number
  /**
   * Σ ridden target ÷ Σ planned watts over the seconds ridden, as a whole
   * percent. Present only when the rider changed Ride Intensity; absent
   * means the plan ran at 100%.
   */
  intensityPercent?: number
}

/** On-target when |Δ| ≤ max(15% × planned, 20W). */
export function isWithinTargetBand(achievedWatts: number, plannedWatts: number): boolean {
  const band = Math.max(0.15 * plannedWatts, 20)
  return Math.abs(achievedWatts - plannedWatts) <= band
}

/**
 * Expand sparse step-corner planned profiles (start/end pairs per step) to a
 * 1 Hz step-hold series through the final tSec. Last write wins at duplicate
 * timestamps (step transitions). Already-dense 1 Hz series pass through
 * unchanged via the same hold rule.
 */
export function expandStepHoldWattSeries(
  points: PowerProfilePoint[],
): (number | null)[] {
  if (points.length === 0) return []
  const sorted = [...points].sort((a, b) => a.tSec - b.tSec)
  const events: { tSec: number; watts: number | null }[] = []
  for (const p of sorted) {
    const last = events[events.length - 1]
    if (last && last.tSec === p.tSec) {
      last.watts = p.watts
    } else {
      events.push({ tSec: p.tSec, watts: p.watts })
    }
  }
  const maxT = events[events.length - 1]!.tSec
  if (maxT < 0) return []

  const out: (number | null)[] = []
  let ei = 0
  for (let t = 0; t <= maxT; t++) {
    while (ei + 1 < events.length && events[ei + 1]!.tSec <= t) {
      ei += 1
    }
    if (events[ei]!.tSec > t) continue
    out.push(events[ei]!.watts)
  }
  return out
}

export function computeSessionAdherence(
  achievedPowerProfile: PowerProfilePoint[],
  plannedPowerProfile: PowerProfilePoint[] | null,
  targetPowerProfile: PowerProfilePoint[] | null = null,
): SessionAdherence | null {
  if (!plannedPowerProfile || plannedPowerProfile.length === 0) {
    return null
  }

  const planned = expandStepHoldWattSeries(plannedPowerProfile)
  const achieved = flattenWattSeries(achievedPowerProfile)
  if (planned.length === 0) return null

  const completionRatio = Math.min(1, achieved.length / planned.length)
  const ridden =
    targetPowerProfile && targetPowerProfile.length > 0
      ? expandStepHoldWattSeries(targetPowerProfile)
      : null
  const target = ridden && ridden.length > 0 ? ridden : planned

  const overlap = Math.min(target.length, achieved.length)
  let scored = 0
  let onTarget = 0
  for (let i = 0; i < overlap; i++) {
    const plannedWatts = target[i]
    if (plannedWatts === null) continue
    scored += 1
    if (isWithinTargetBand(achieved[i]!, plannedWatts)) onTarget += 1
  }

  const adherence: SessionAdherence = {
    completionRatio: Math.round(completionRatio * 1000) / 1000,
    targetAdherence:
      scored === 0 ? 1 : Math.round((onTarget / scored) * 1000) / 1000,
  }
  if (target !== planned) {
    adherence.intensityPercent = rideIntensityPercent(
      planned,
      target,
      achieved.length,
    )
  }
  return adherence
}

/** Watts-weighted share of the plan the rider asked for while riding. */
function rideIntensityPercent(
  planned: readonly (number | null)[],
  target: readonly (number | null)[],
  riddenSec: number,
): number {
  const n = Math.min(planned.length, target.length, riddenSec)
  let plannedSum = 0
  let targetSum = 0
  for (let i = 0; i < n; i++) {
    const plannedWatts = planned[i]
    const targetWatts = target[i]
    if (plannedWatts === null || targetWatts === null) continue
    plannedSum += plannedWatts
    targetSum += targetWatts
  }
  if (plannedSum <= 0) return 100
  return Math.round((targetSum / plannedSum) * 100)
}
