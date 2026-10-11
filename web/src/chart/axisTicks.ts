/** Three evenly spaced ticks from min to max (inclusive). */
export function threeAxisTicks(min: number, max: number): [number, number, number] {
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  const mid = Math.round((lo + hi) / 2)
  return [Math.round(lo), mid, Math.round(hi)]
}

/**
 * Watts Y domain from data min/max with margin on each side.
 * Floor is clamped at 0 W.
 */
export function wattsAxisDomain(
  dataMin: number,
  dataMax: number,
  options?: { marginRatio?: number; minMarginWatts?: number },
): { min: number; max: number } {
  const marginRatio = options?.marginRatio ?? 0.1
  const minMarginWatts = options?.minMarginWatts ?? 10
  const lo = Math.min(dataMin, dataMax)
  const hi = Math.max(dataMin, dataMax)
  const span = Math.max(hi - lo, 0)
  const margin = Math.max(span * marginRatio, minMarginWatts)
  const min = Math.max(0, Math.floor(lo - margin))
  let max = Math.ceil(hi + margin)
  if (max <= min) max = min + minMarginWatts
  return { min, max }
}

/** Elapsed session time for chart X ticks (`m:ss`). */
export function formatAxisTime(sec: number): string {
  const total = Math.max(0, Math.round(sec))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Watts label for chart Y ticks. */
export function formatAxisWatts(watts: number): string {
  return `${Math.round(watts)} W`
}

/** Heart-rate label for chart Y ticks. */
export function formatAxisBpm(bpm: number): string {
  return `${Math.round(bpm)} bpm`
}

/** Cadence label for chart Y ticks. */
export function formatAxisRpm(rpm: number): string {
  return `${Math.round(rpm)} rpm`
}
