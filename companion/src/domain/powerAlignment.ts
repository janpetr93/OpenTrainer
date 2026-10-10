import type { PowerProfilePoint } from './types.js'

/**
 * Mean Power Alignment delta (Meter − Trainer) over achieved samples where
 * meterWatts is present. Null when no paired samples exist.
 */
export function computeAverageAlignmentDeltaWatts(
  profile: PowerProfilePoint[],
): number | null {
  let sum = 0
  let count = 0
  for (const point of profile) {
    if (point.meterWatts === null || point.meterWatts === undefined) continue
    sum += point.meterWatts - point.watts
    count += 1
  }
  if (count === 0) return null
  return Math.round(sum / count)
}
