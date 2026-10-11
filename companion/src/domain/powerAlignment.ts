import type { PowerProfilePoint } from './types.js'

/** Meter − Trainer for one sample, or null when unpaired. */
function sampleAlignmentDelta(point: PowerProfilePoint): number | null {
  if (point.trainerWatts !== null && point.trainerWatts !== undefined) {
    return point.watts - point.trainerWatts
  }
  if (point.meterWatts !== null && point.meterWatts !== undefined) {
    return point.meterWatts - point.watts
  }
  return null
}

/**
 * Mean Power Alignment delta (Meter − Trainer) over achieved samples with a
 * paired secondary stream (`meterWatts` or `trainerWatts`). Null when none.
 */
export function computeAverageAlignmentDeltaWatts(
  profile: PowerProfilePoint[],
): number | null {
  let sum = 0
  let count = 0
  for (const point of profile) {
    const delta = sampleAlignmentDelta(point)
    if (delta === null) continue
    sum += delta
    count += 1
  }
  if (count === 0) return null
  return Math.round(sum / count)
}
