import type { Activity, PowerProfilePoint, SessionLoad } from '../api'

function formatSessionLoadLine(load: SessionLoad): string | null {
  const parts: string[] = []
  if (load.normalizedPowerWatts != null) {
    parts.push(`NP ${load.normalizedPowerWatts}`)
  }
  if (load.intensityFactor != null) {
    parts.push(`IF ${load.intensityFactor.toFixed(2)}`)
  }
  if (load.trainingStressScore != null) {
    parts.push(`TSS ${load.trainingStressScore}`)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

function formatDuration(durationSec: number): string {
  const minutes = Math.floor(durationSec / 60)
  const seconds = durationSec % 60
  if (minutes === 0) return `${seconds}s`
  if (seconds === 0) return `${minutes}m`
  return `${minutes}m ${seconds}s`
}

/**
 * Planned Power Profile is step corners: a hold, then the next step's watts
 * at the same timestamp. Last write at a timestamp is the new step.
 */
function formatPlannedStructure(
  points: readonly PowerProfilePoint[],
): string | null {
  if (points.length < 2) return null
  const ordered = points.map((point, index) => ({ ...point, index }))
  ordered.sort((a, b) => a.tSec - b.tSec || a.index - b.index)

  const events: { tSec: number; watts: number }[] = []
  for (const point of ordered) {
    const watts = Math.round(point.watts)
    const last = events[events.length - 1]
    if (last && last.tSec === point.tSec) last.watts = watts
    else events.push({ tSec: point.tSec, watts })
  }

  const segments: { durationSec: number; watts: number }[] = []
  for (let i = 0; i < events.length - 1; i++) {
    const durationSec = events[i + 1]!.tSec - events[i]!.tSec
    if (durationSec <= 0) continue
    const watts = events[i]!.watts
    const previous = segments[segments.length - 1]
    if (previous && previous.watts === watts) previous.durationSec += durationSec
    else segments.push({ durationSec, watts })
  }

  if (segments.length === 0 || segments.every((segment) => segment.watts === 0)) {
    return null
  }

  return segments
    .map((segment) => `${formatDuration(segment.durationSec)} - ${segment.watts}W`)
    .join(', ')
}

/** Strava activity description: Session Load, then planned watts. No Session Purpose. */
export function stravaActivityDescription(
  activity: Pick<Activity, 'sessionLoad' | 'plannedPowerProfile'>,
): string | undefined {
  const loadLine = activity.sessionLoad
    ? formatSessionLoadLine(activity.sessionLoad)
    : null
  const structure = activity.plannedPowerProfile
    ? formatPlannedStructure(activity.plannedPowerProfile)
    : null
  if (loadLine && structure) return `${loadLine}\n\n${structure}`
  return loadLine ?? structure ?? undefined
}
