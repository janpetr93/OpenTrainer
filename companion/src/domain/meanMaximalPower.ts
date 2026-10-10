import type { Activity, PowerProfilePoint } from './types.js'

/** Fixed MMP durations (seconds): 5s … 90min. */
export const MMP_DURATIONS_SEC = [
  5, 10, 30, 60, 300, 600, 1200, 3600, 5400,
] as const

export type MmpDurationSec = (typeof MMP_DURATIONS_SEC)[number]

export type MmpPoint = {
  durationSec: MmpDurationSec
  watts: number | null
  activityId: string | null
  startedAt: string | null
}

export type MmpFingerprint = {
  activityCount: number
  latestActivityId: string | null
  latestCreatedAt: string | null
}

export type MmpComputeResult = {
  points: MmpPoint[]
  fingerprint: MmpFingerprint
}

/** Contiguous 1s watt runs; gaps (non-consecutive tSec) start a new segment. */
export function contiguousWattSegments(
  points: PowerProfilePoint[],
): number[][] {
  if (points.length === 0) return []
  const sorted = [...points].sort((a, b) => a.tSec - b.tSec)
  const segments: number[][] = []
  let current: number[] = [sorted[0]!.watts]
  let prevT = sorted[0]!.tSec

  for (let i = 1; i < sorted.length; i++) {
    const p = sorted[i]!
    if (p.tSec === prevT + 1) {
      current.push(p.watts)
      prevT = p.tSec
    } else if (p.tSec === prevT) {
      // Same second: keep last sample (matches PowerSampler overwrite).
      current[current.length - 1] = p.watts
    } else {
      segments.push(current)
      current = [p.watts]
      prevT = p.tSec
    }
  }
  segments.push(current)
  return segments
}

function maxMeanForDuration(segment: number[], durationSec: number): number | null {
  if (segment.length < durationSec) return null
  let sum = 0
  for (let i = 0; i < durationSec; i++) sum += segment[i]!
  let best = sum
  for (let end = durationSec; end < segment.length; end++) {
    sum += segment[end]! - segment[end - durationSec]!
    if (sum > best) best = sum
  }
  return best / durationSec
}

function bestForActivity(
  activity: Activity,
  durationSec: number,
): number | null {
  let best: number | null = null
  for (const seg of contiguousWattSegments(activity.achievedPowerProfile)) {
    const mean = maxMeanForDuration(seg, durationSec)
    if (mean === null) continue
    if (best === null || mean > best) best = mean
  }
  return best
}

export function mmpFingerprint(activities: Activity[]): MmpFingerprint {
  if (activities.length === 0) {
    return {
      activityCount: 0,
      latestActivityId: null,
      latestCreatedAt: null,
    }
  }
  let latest = activities[0]!
  for (const a of activities) {
    if (a.createdAt > latest.createdAt) latest = a
    else if (a.createdAt === latest.createdAt && a.id > latest.id) latest = a
  }
  return {
    activityCount: activities.length,
    latestActivityId: latest.id,
    latestCreatedAt: latest.createdAt,
  }
}

export function computeMmpFromActivities(
  activities: Activity[],
): MmpComputeResult {
  const points: MmpPoint[] = MMP_DURATIONS_SEC.map((durationSec) => {
    let bestMean: number | null = null
    let activityId: string | null = null
    let startedAt: string | null = null
    for (const activity of activities) {
      const mean = bestForActivity(activity, durationSec)
      if (mean === null) continue
      if (bestMean === null || mean > bestMean) {
        bestMean = mean
        activityId = activity.id
        startedAt = activity.startedAt
      }
    }
    return {
      durationSec,
      watts: bestMean === null ? null : Math.round(bestMean),
      activityId,
      startedAt,
    }
  })
  return { points, fingerprint: mmpFingerprint(activities) }
}

/** Coggan-style estimate from 20min MMP. */
export function estimatedFtpFromMmp(
  points: ReadonlyArray<{ durationSec: number; watts: number | null }>,
): number | null {
  const twenty = points.find((p) => p.durationSec === 1200)
  if (!twenty || twenty.watts === null) return null
  return Math.round(twenty.watts * 0.95)
}

export function fingerprintsMatch(
  a: MmpFingerprint,
  b: MmpFingerprint,
): boolean {
  return (
    a.activityCount === b.activityCount &&
    a.latestActivityId === b.latestActivityId &&
    a.latestCreatedAt === b.latestCreatedAt
  )
}
