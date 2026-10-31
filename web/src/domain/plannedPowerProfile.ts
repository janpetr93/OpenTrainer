import type { PowerProfilePoint, WorkoutItem } from '../api'
import { resolveStepWatts } from './resolveTarget'
import { expandWorkoutItems } from './workoutItems'

/**
 * Derive a planned Power Profile from Workout steps.
 * Zone/%FTP steps need ftpWatts; otherwise those segments are 0 W.
 * Workout Repeats are expanded before the profile is built.
 */
export function buildPlannedPowerProfile(
  steps: readonly WorkoutItem[],
  ftpWatts: number | null = null,
): PowerProfilePoint[] {
  const points: PowerProfilePoint[] = []
  let t = 0

  for (const step of expandWorkoutItems(steps)) {
    let watts = 0
    try {
      watts = resolveStepWatts(step, ftpWatts) ?? 0
    } catch {
      watts = 0
    }
    points.push({ tSec: t, watts })
    t += step.durationSec
    points.push({ tSec: t, watts })
  }

  return points
}
