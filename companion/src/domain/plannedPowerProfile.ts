import { resolveStepWatts } from './resolveTarget.js'
import type { PowerProfilePoint, WorkoutStep } from './types.js'

/**
 * Derive a planned Power Profile from Workout steps.
 * Zone/%FTP steps need ftpWatts; otherwise those segments are 0 W.
 */
export function buildPlannedPowerProfile(
  steps: WorkoutStep[],
  ftpWatts: number | null = null,
): PowerProfilePoint[] {
  const points: PowerProfilePoint[] = []
  let t = 0

  for (const step of steps) {
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
