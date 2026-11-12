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
    let watts: number | null = 0
    if (step.type === 'open') {
      watts = null
    } else {
      try {
        watts = resolveStepWatts(step, ftpWatts) ?? 0
      } catch {
        watts = 0
      }
    }
    points.push({ tSec: t, watts })
    t += step.durationSec
    points.push({ tSec: t, watts })
  }

  return points
}

/**
 * Step-corner profile cut at `endSec`: the part of the plan that was ridden
 * before a Workout continued as a Free Ride. A step that spans the cut ends
 * there; zero-length step transitions are dropped.
 */
export function truncatePowerProfile(
  points: readonly PowerProfilePoint[],
  endSec: number,
): PowerProfilePoint[] {
  const out: PowerProfilePoint[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i]!
    const end = points[i + 1]!
    if (start.tSec >= endSec) break
    if (end.tSec <= start.tSec) continue
    out.push(
      { tSec: start.tSec, watts: start.watts },
      { tSec: Math.min(end.tSec, endSec), watts: start.watts },
    )
  }
  return out
}
