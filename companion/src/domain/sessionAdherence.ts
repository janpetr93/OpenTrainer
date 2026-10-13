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

/**
 * Expand sparse step-corner planned profiles (start/end pairs per step) to a
 * 1 Hz step-hold series through the final tSec. Last write wins at duplicate
 * timestamps (step transitions). Already-dense 1 Hz series pass through
 * unchanged via the same hold rule.
 */
export function expandStepHoldWattSeries(
  points: PowerProfilePoint[],
): number[] {
  if (points.length === 0) return []
  const sorted = [...points].sort((a, b) => a.tSec - b.tSec)
  const events: { tSec: number; watts: number }[] = []
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

  const out: number[] = []
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
): SessionAdherence | null {
  if (!plannedPowerProfile || plannedPowerProfile.length === 0) {
    return null
  }

  const planned = expandStepHoldWattSeries(plannedPowerProfile)
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
