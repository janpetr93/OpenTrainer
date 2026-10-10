import type { Activity, PowerProfilePoint, Workout } from '../api'
import { buildScheduledWorkoutPreview } from '../domain/scheduledWorkoutPreview'
import type { PowerProfileSeries } from '../PowerProfileLine'

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}

export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString()
}

/** Workout name when known; Free ride for Activities without a Workout. */
export function sessionTitle(
  workoutName: string | null | undefined,
  kind: 'scheduled' | 'activity',
): string {
  const name = workoutName?.trim()
  if (name) return name
  return kind === 'activity' ? 'Free ride' : 'Workout'
}

export function activitySummary(activity: Activity): string {
  const parts = [formatDuration(activity.durationSec)]
  if (activity.averagePowerWatts !== null) {
    parts.push(`avg ${activity.averagePowerWatts} W`)
  }
  if (activity.maxPowerWatts !== null) {
    parts.push(`max ${activity.maxPowerWatts} W`)
  }
  parts.push(activity.plannedPowerProfile ? 'vs plan' : 'free ride')
  return parts.join(' · ')
}

export function activitySecondary(activity: Activity): string {
  return `${formatDateTime(activity.startedAt)} · ${activitySummary(activity)}`
}

export function scheduledSecondary(
  startsAtIso: string,
  durationLabel: string,
): string {
  return `${formatClockTime(startsAtIso)} · ${durationLabel}`
}

export type SessionChartModel = {
  plannedPoints: PowerProfilePoint[] | null
  achievedPoints: PowerProfilePoint[] | null
  needsFtpToPreview: boolean
  showLegend: boolean
  series: PowerProfileSeries[]
}

export function chartFromScheduledWorkout(
  workout: Workout | undefined,
  ftpWatts: number | null,
): SessionChartModel {
  if (!workout) {
    return {
      plannedPoints: null,
      achievedPoints: null,
      needsFtpToPreview: false,
      showLegend: false,
      series: [],
    }
  }
  const preview = buildScheduledWorkoutPreview(workout, ftpWatts)
  const planned =
    preview.plannedPowerProfile && preview.plannedPowerProfile.length >= 2
      ? preview.plannedPowerProfile
      : null
  return {
    plannedPoints: planned,
    achievedPoints: null,
    needsFtpToPreview: preview.needsFtpToPreview,
    showLegend: false,
    series: planned ? [{ points: planned, tone: 'planned' }] : [],
  }
}

export function chartFromActivity(activity: Activity): SessionChartModel {
  const planned =
    activity.plannedPowerProfile && activity.plannedPowerProfile.length >= 2
      ? activity.plannedPowerProfile
      : null
  const achieved =
    activity.achievedPowerProfile.length >= 2
      ? activity.achievedPowerProfile
      : null
  const series: PowerProfileSeries[] = [
    ...(planned ? [{ points: planned, tone: 'planned' as const }] : []),
    ...(achieved ? [{ points: achieved, tone: 'achieved' as const }] : []),
  ]
  return {
    plannedPoints: planned,
    achievedPoints: achieved,
    needsFtpToPreview: false,
    showLegend: Boolean(planned && achieved),
    series,
  }
}

export function scheduledDurationLabel(
  workout: Workout | undefined,
  ftpWatts: number | null,
): string {
  if (!workout) return formatDuration(0)
  return buildScheduledWorkoutPreview(workout, ftpWatts).durationLabel
}
