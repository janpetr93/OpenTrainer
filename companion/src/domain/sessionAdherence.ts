import { flattenWattSeries } from './sessionLoad.js'
import type { PowerProfilePoint } from './types.js'

export type SessionAdherence = {
  /** Achieved duration / planned duration, capped at 1. */
  completionRatio: number
  /**
   * Fraction of overlapping seconds within the target band. Each second is
   * scored from a 5s centered average of achieved watts that stops at a
   * target change, against the ridden targets when Ride Intensity changed.
   */
  targetAdherence: number
  /**
   * Σ ridden target ÷ Σ planned watts over the seconds ridden, as a whole
   * percent. Present only when the rider changed Ride Intensity; absent
   * means the plan ran at 100%.
   */
  intensityPercent?: number
}

/**
 * Bump when the On-target formula changes so startup backfill rewrites
 * stored Session Adherence. Absent on disk means the previous formula.
 */
export const SESSION_ADHERENCE_REVISION = 2

/** History chart smooths measured watts over this centered window. */
const ON_TARGET_AVERAGE_SEC = 5
const ON_TARGET_AVERAGE_RADIUS_SEC = Math.floor(ON_TARGET_AVERAGE_SEC / 2)

/** On-target when |Δ| ≤ max(15% × planned, 20W). */
export function isWithinTargetBand(achievedWatts: number, plannedWatts: number): boolean {
  const band = Math.max(0.15 * plannedWatts, 20)
  return Math.abs(achievedWatts - plannedWatts) <= band
}

/**
 * Centered average of achieved watts, ±2s, stopping at a target change so a
 * step does not borrow power from the one before it. Same window the History
 * chart uses for the measured power line.
 */
function smoothedAchievedWatts(
  achieved: readonly number[],
  target: readonly (number | null)[],
  index: number,
  lastIndex: number,
): number {
  const plannedWatts = target[index]
  let sum = 0
  let count = 0
  for (
    let k = index;
    k >= 0 && index - k <= ON_TARGET_AVERAGE_RADIUS_SEC;
    k--
  ) {
    if (target[k] !== plannedWatts) break
    sum += achieved[k]!
    count += 1
  }
  for (
    let k = index + 1;
    k <= lastIndex && k - index <= ON_TARGET_AVERAGE_RADIUS_SEC;
    k++
  ) {
    if (target[k] !== plannedWatts) break
    sum += achieved[k]!
    count += 1
  }
  return sum / count
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

  // Score the plan only: a Workout that continued as a Free Ride carries
  // ridden targets past the plan's end.
  const overlap = Math.min(target.length, achieved.length, planned.length)
  const lastIndex = overlap - 1
  let scored = 0
  let onTarget = 0
  for (let i = 0; i < overlap; i++) {
    const plannedWatts = target[i]
    if (plannedWatts === null) continue
    scored += 1
    const achievedWatts = smoothedAchievedWatts(
      achieved,
      target,
      i,
      lastIndex,
    )
    if (isWithinTargetBand(achievedWatts, plannedWatts)) onTarget += 1
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
