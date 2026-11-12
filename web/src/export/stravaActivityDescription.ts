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

type PlannedSegment = { durationSec: number; watts: number | null }

function formatSegment(segment: PlannedSegment): string {
  if (segment.watts === null) {
    return `${formatDuration(segment.durationSec)} - open`
  }
  return `${formatDuration(segment.durationSec)} - ${segment.watts}W`
}

function sameSegment(a: PlannedSegment, b: PlannedSegment): boolean {
  return a.durationSec === b.durationSec && a.watts === b.watts
}

/** True when `count` copies of `segments[start..start+period)` sit in a row. */
function cycleRepeats(
  segments: readonly PlannedSegment[],
  start: number,
  period: number,
  count: number,
): boolean {
  for (let rep = 1; rep < count; rep++) {
    for (let offset = 0; offset < period; offset++) {
      const base = segments[start + offset]
      const next = segments[start + rep * period + offset]
      if (!base || !next || !sameSegment(base, next)) return false
    }
  }
  return true
}

/**
 * Longest run of a repeated cycle, preferring the shorter cycle when two
 * runs cover the same steps (4x (A, B) rather than 2x (A, B, A, B)).
 */
function repeatedCycle(
  segments: readonly PlannedSegment[],
  start: number,
): { period: number; count: number } | null {
  let best: { period: number; count: number } | null = null
  const maxPeriod = Math.floor((segments.length - start) / 2)
  for (let period = 1; period <= maxPeriod; period++) {
    let count = 1
    while (
      start + (count + 1) * period <= segments.length &&
      cycleRepeats(segments, start, period, count + 1)
    ) {
      count++
    }
    if (count < 2) continue
    const coverage = count * period
    if (
      best === null ||
      coverage > best.count * best.period ||
      (coverage === best.count * best.period && period < best.period)
    ) {
      best = { period, count }
    }
  }
  return best
}

function formatGroupedSegments(segments: readonly PlannedSegment[]): string {
  const lines: string[] = []
  let index = 0
  while (index < segments.length) {
    const cycle = repeatedCycle(segments, index)
    if (cycle) {
      const inner = segments
        .slice(index, index + cycle.period)
        .map(formatSegment)
        .join(', ')
      lines.push(`${cycle.count}x (${inner})`)
      index += cycle.count * cycle.period
    } else {
      lines.push(formatSegment(segments[index]!))
      index++
    }
  }
  return lines.join('\n')
}

/**
 * Planned Power Profile is step corners: a hold, then the next step's watts
 * at the same timestamp. Last write at a timestamp is the new step.
 * One block per line. A cycle that repeats at least twice collapses to
 * `3x (15s - 240W, 1m - 100W)`.
 */
function formatPlannedStructure(
  points: readonly PowerProfilePoint[],
): string | null {
  if (points.length < 2) return null
  const ordered = points.map((point, index) => ({ ...point, index }))
  ordered.sort((a, b) => a.tSec - b.tSec || a.index - b.index)

  const events: { tSec: number; watts: number | null }[] = []
  for (const point of ordered) {
    const watts = point.watts === null ? null : Math.round(point.watts)
    const last = events[events.length - 1]
    if (last && last.tSec === point.tSec) last.watts = watts
    else events.push({ tSec: point.tSec, watts })
  }

  const segments: PlannedSegment[] = []
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

  return formatGroupedSegments(segments)
}

/** `+ 25 min free ride` after a Workout that continued as a Free Ride. */
function formatFreeRideTail(
  activity: Partial<Pick<Activity, 'freeRideFromSec' | 'durationSec'>>,
): string | null {
  const from = activity.freeRideFromSec
  if (from == null || activity.durationSec == null) return null
  const minutes = Math.round((activity.durationSec - from) / 60)
  return minutes >= 1 ? `+ ${minutes} min free ride` : null
}

/**
 * Strava activity description: Session Load, then planned watts, then the
 * Ride Intensity when the plan was not ridden at 100%, then the minutes
 * ridden as a Free Ride after the Workout. No Session Purpose.
 */
export function stravaActivityDescription(
  activity: Pick<Activity, 'sessionLoad' | 'plannedPowerProfile'> &
    Partial<
      Pick<Activity, 'sessionAdherence' | 'freeRideFromSec' | 'durationSec'>
    >,
): string | undefined {
  const loadLine = activity.sessionLoad
    ? formatSessionLoadLine(activity.sessionLoad)
    : null
  const planned = activity.plannedPowerProfile
    ? formatPlannedStructure(activity.plannedPowerProfile)
    : null
  const intensity = activity.sessionAdherence?.intensityPercent
  const lines = [
    planned,
    planned && intensity !== undefined && intensity !== 100
      ? `Ridden at ${intensity}% of plan`
      : null,
    formatFreeRideTail(activity),
  ].filter((line): line is string => line !== null)
  const structure = lines.length > 0 ? lines.join('\n') : null
  if (loadLine && structure) return `${loadLine}\n\n${structure}`
  return loadLine ?? structure ?? undefined
}
