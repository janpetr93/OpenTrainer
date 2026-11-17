import { localDateKey } from './blocker.js'
import { bestMeanWatts } from './meanMaximalPower.js'
import type { Activity } from './types.js'

/** One logged change of set FTP. Null watts is a clear. */
export type FtpHistoryEntry = {
  setAt: string
  ftpWatts: number | null
}

export type FtpProgressionPoint = {
  date: string
  setFtpWatts: number | null
  estimatedFtpWatts: number | null
}

export type FtpProgression = {
  through: string
  points: FtpProgressionPoint[]
}

const TWENTY_MIN_SEC = 1200

/** Absent until the first step. Null is a real clear, distinct from absent. */
type Held = number | null | undefined

export function buildFtpProgression(input: {
  activities: Activity[]
  ftpHistory: FtpHistoryEntry[]
  currentFtpWatts: number | null
  now: Date
}): FtpProgression {
  const through = localDateKey(input.now.toISOString())
  const setByDate = setFtpByDate(
    input.activities,
    input.ftpHistory,
    input.currentFtpWatts,
    input.now,
  )
  const estimatedByDate = estimatedFtpByDate(input.activities)
  return {
    through,
    points: mergeSteps(setByDate, estimatedByDate),
  }
}

function setFtpByDate(
  activities: Activity[],
  ftpHistory: FtpHistoryEntry[],
  currentFtpWatts: number | null,
  now: Date,
): Map<string, number | null> {
  const orderedLog = [...ftpHistory].sort((a, b) =>
    a.setAt.localeCompare(b.setAt),
  )
  const firstLogMs = orderedLog[0] ? Date.parse(orderedLog[0].setAt) : Infinity
  const prior = activities
    .filter((activity) => {
      const ftp = activity.sessionLoad?.ftpWattsAtSave
      return ftp != null && Date.parse(activity.startedAt) < firstLogMs
    })
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))

  const byDate = new Map<string, number | null>()
  let held: Held = undefined
  const apply = (at: string, watts: number | null) => {
    if (held !== undefined && watts === held) return
    held = watts
    byDate.set(localDateKey(at), watts)
  }
  for (const activity of prior) {
    apply(activity.startedAt, activity.sessionLoad!.ftpWattsAtSave)
  }
  for (const entry of orderedLog) apply(entry.setAt, entry.ftpWatts)
  const unset = held === undefined && currentFtpWatts === null
  if (!unset && currentFtpWatts !== held) {
    apply(now.toISOString(), currentFtpWatts)
  }
  return byDate
}

function estimatedFtpByDate(activities: Activity[]): Map<string, number> {
  const byDate = new Map<string, number>()
  let bestMean: number | null = null
  let bestEstimate: number | null = null
  const ordered = [...activities].sort((a, b) =>
    a.startedAt.localeCompare(b.startedAt),
  )
  for (const activity of ordered) {
    const mean = bestMeanWatts(activity, TWENTY_MIN_SEC)
    if (mean === null) continue
    if (bestMean !== null && mean <= bestMean) continue
    bestMean = mean
    const estimate = Math.round(mean * 0.95)
    if (bestEstimate !== null && estimate <= bestEstimate) continue
    bestEstimate = estimate
    byDate.set(localDateKey(activity.startedAt), estimate)
  }
  return byDate
}

function mergeSteps(
  setByDate: Map<string, number | null>,
  estimatedByDate: Map<string, number>,
): FtpProgressionPoint[] {
  const dates = [...new Set([...setByDate.keys(), ...estimatedByDate.keys()])].sort()
  const points: FtpProgressionPoint[] = []
  let setWatts: Held = undefined
  let estimatedWatts: Held = undefined
  for (const date of dates) {
    let changed = false
    if (setByDate.has(date)) {
      const next = setByDate.get(date) ?? null
      if (next !== setWatts) {
        setWatts = next
        changed = true
      }
    }
    if (estimatedByDate.has(date)) {
      const next = estimatedByDate.get(date)!
      if (next !== estimatedWatts) {
        estimatedWatts = next
        changed = true
      }
    }
    if (!changed) continue
    points.push({
      date,
      setFtpWatts: setWatts ?? null,
      estimatedFtpWatts: estimatedWatts ?? null,
    })
  }
  return points
}
