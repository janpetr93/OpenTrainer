import type { PowerProfilePoint, WorkoutStep } from '../api'
import { buildPlannedPowerProfile } from './plannedPowerProfile'
import { workoutNeedsFtp } from './resolveTarget'

export type ScheduledWorkoutPreview = {
  durationSec: number
  durationLabel: string
  /** Planned profile when chartable; null when FTP is required but missing. */
  plannedPowerProfile: PowerProfilePoint[] | null
  needsFtpToPreview: boolean
}

function formatDurationLabel(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}

export function buildScheduledWorkoutPreview(
  workout: { steps: WorkoutStep[] },
  ftpWatts: number | null,
): ScheduledWorkoutPreview {
  const durationSec = workout.steps.reduce((sum, s) => sum + s.durationSec, 0)
  const needsFtpToPreview =
    workoutNeedsFtp(workout.steps) && (ftpWatts === null || ftpWatts <= 0)
  return {
    durationSec,
    durationLabel: formatDurationLabel(durationSec),
    plannedPowerProfile: needsFtpToPreview
      ? null
      : buildPlannedPowerProfile(workout.steps, ftpWatts),
    needsFtpToPreview,
  }
}
