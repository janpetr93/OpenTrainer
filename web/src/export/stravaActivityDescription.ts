import type { Activity, SessionLoad } from '../api'

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

/** Strava activity description for an OpenTrainer Activity upload. */
export function stravaActivityDescription(
  activity: Pick<Activity, 'purpose' | 'sessionLoad'>,
): string | undefined {
  const purpose = activity.purpose?.trim() || null
  const loadLine = activity.sessionLoad
    ? formatSessionLoadLine(activity.sessionLoad)
    : null
  if (purpose && loadLine) return `${purpose}\n\n${loadLine}`
  if (purpose) return purpose
  if (loadLine) return loadLine
  return undefined
}
