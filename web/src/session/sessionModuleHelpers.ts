import type { Activity, PowerProfilePoint, Workout } from '../api'
import { buildScheduledWorkoutPreview } from '../domain/scheduledWorkoutPreview'
import type { PowerProfileSeries } from '../PowerProfileLine'

export type SessionMetric = {
  label: string
  value: string
}

export type SessionMeta = {
  /** Compact when-label; empty when not applicable. */
  when: string
  /** Quiet kind tag (Free ride, vs plan, From Calendar). */
  kind: string | null
  metrics: SessionMetric[]
}

export function formatDuration(sec: number): string {
  const total = Math.max(0, Math.round(sec))
  const m = Math.floor(total / 60)
  const s = total % 60
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}

export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** @deprecated Prefer formatCompactDateTime for SessionModule. */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function formatCompactTime(iso: string): string {
  return formatClockTime(iso)
}

export function formatCompactDateTime(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString([], { day: 'numeric', month: 'short' })
  const time = formatCompactTime(iso)
  return `${date} · ${time}`
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

function wattsLabel(watts: number | null | undefined): string {
  return `${watts ?? 0} W`
}

export function activityMeta(activity: Activity): SessionMeta {
  const load = activity.sessionLoad
  const metrics: SessionMetric[] = [
    { label: 'Duration', value: formatDuration(activity.durationSec) },
    { label: 'Avg', value: wattsLabel(activity.averagePowerWatts) },
    { label: 'Max', value: wattsLabel(activity.maxPowerWatts) },
    { label: 'NP', value: wattsLabel(load?.normalizedPowerWatts) },
    {
      label: 'IF',
      value: (load?.intensityFactor ?? 0).toFixed(2),
    },
    {
      label: 'TSS',
      value: String(load?.trainingStressScore ?? 0),
    },
  ]
  const adherence = activity.sessionAdherence
  if (adherence) {
    metrics.push({
      label: 'Done',
      value: `${Math.round(adherence.completionRatio * 100)}%`,
    })
    metrics.push({
      label: 'On-target',
      value: `${Math.round(adherence.targetAdherence * 100)}%`,
    })
  }
  return {
    when: formatCompactDateTime(activity.startedAt),
    // Title already says "Free ride" when there is no Workout name.
    kind: activity.plannedPowerProfile ? 'vs plan' : null,
    metrics,
  }
}

/** @deprecated Prefer activityMeta for SessionModule. */
export function formatSessionLoadAdherence(activity: Activity): string | null {
  const parts: string[] = []
  const load = activity.sessionLoad
  if (load?.normalizedPowerWatts != null) {
    parts.push(`NP ${load.normalizedPowerWatts} W`)
  }
  if (load?.intensityFactor != null) {
    parts.push(`IF ${load.intensityFactor.toFixed(2)}`)
  }
  if (load?.trainingStressScore != null) {
    parts.push(`TSS ${load.trainingStressScore}`)
  }
  const adherence = activity.sessionAdherence
  if (adherence) {
    parts.push(`done ${Math.round(adherence.completionRatio * 100)}%`)
    parts.push(`on-target ${Math.round(adherence.targetAdherence * 100)}%`)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

/** @deprecated Prefer activityMeta for SessionModule. */
export function activitySummary(activity: Activity): string {
  const parts = [formatDuration(activity.durationSec)]
  if (activity.averagePowerWatts !== null) {
    parts.push(`avg ${activity.averagePowerWatts} W`)
  }
  if (activity.maxPowerWatts !== null) {
    parts.push(`max ${activity.maxPowerWatts} W`)
  }
  const loadLine = formatSessionLoadAdherence(activity)
  if (loadLine) parts.push(loadLine)
  parts.push(activity.plannedPowerProfile ? 'vs plan' : 'free ride')
  return parts.join(' · ')
}

/** @deprecated Prefer activityMeta for SessionModule. */
export function activitySecondary(activity: Activity): string {
  return `${formatDateTime(activity.startedAt)} · ${activitySummary(activity)}`
}

export function scheduledOutcomeLabel(ride: {
  status?: string | null
  missed?: boolean
}): string | null {
  if (ride.status === 'completed') return 'completed'
  if (ride.status === 'skipped') return 'skipped'
  if (ride.missed) return 'missed'
  return null
}

export function scheduledMeta(
  startsAtIso: string | null,
  durationLabel: string,
  outcome: string | null = null,
  kind: string | null = null,
): SessionMeta {
  const metrics: SessionMetric[] = [
    { label: 'Duration', value: durationLabel },
  ]
  if (outcome) {
    metrics.push({ label: 'Status', value: outcome })
  }
  return {
    when: startsAtIso ? formatCompactTime(startsAtIso) : '',
    kind,
    metrics,
  }
}

/** @deprecated Prefer scheduledMeta for SessionModule. */
export function scheduledSecondary(
  startsAtIso: string,
  durationLabel: string,
  outcome: string | null = null,
): string {
  const base = `${formatClockTime(startsAtIso)} · ${durationLabel}`
  return outcome ? `${base} · ${outcome}` : base
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
