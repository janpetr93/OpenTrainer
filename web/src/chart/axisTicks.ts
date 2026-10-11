/** Three evenly spaced ticks from min to max (inclusive). */
export function threeAxisTicks(min: number, max: number): [number, number, number] {
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  const mid = Math.round((lo + hi) / 2)
  return [Math.round(lo), mid, Math.round(hi)]
}

/** Round a range/step onto the 1–2–5 × 10ⁿ ladder (Wilkinson-style). */
function niceNum(range: number, round: boolean): number {
  const abs = Math.abs(range)
  if (!(abs > 0) || !Number.isFinite(abs)) return 1
  const exponent = Math.floor(Math.log10(abs))
  const fraction = abs / 10 ** exponent
  let niceFraction: number
  if (round) {
    if (fraction < 1.5) niceFraction = 1
    else if (fraction < 3) niceFraction = 2
    else if (fraction < 7) niceFraction = 5
    else niceFraction = 10
  } else if (fraction <= 1) niceFraction = 1
  else if (fraction <= 2) niceFraction = 2
  else if (fraction <= 5) niceFraction = 5
  else niceFraction = 10
  return niceFraction * 10 ** exponent
}

/**
 * Round ticks covering [min, max] (~`targetCount` values).
 * Values stay inside the domain so they align with the plotted scale.
 */
export function niceAxisTicks(
  min: number,
  max: number,
  targetCount = 5,
): number[] {
  const lo = Math.min(min, max)
  const hi = Math.max(min, max)
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return []
  if (hi === lo) return [lo]

  const count = Math.max(2, Math.round(targetCount))
  const range = niceNum(hi - lo, false)
  const step = niceNum(range / (count - 1), true)
  if (!(step > 0)) return [lo, hi]

  const start = Math.ceil(lo / step - 1e-9) * step
  const ticks: number[] = []
  const eps = step * 1e-6
  for (let v = start; v <= hi + eps; v += step) {
    const tick = Math.abs(v) < eps ? 0 : Number(v.toPrecision(12))
    if (tick + eps >= lo && tick - eps <= hi) ticks.push(tick)
  }
  return ticks.length > 0 ? ticks : [lo, hi]
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

/** Watts label for chart Y ticks. Unit on by default; omit on inner ticks. */
export function formatAxisWatts(watts: number, withUnit = true): string {
  const n = Math.round(watts)
  return withUnit ? `${n} W` : String(n)
}

/** Heart-rate label for chart Y ticks. */
export function formatAxisBpm(bpm: number, withUnit = true): string {
  const n = Math.round(bpm)
  return withUnit ? `${n} bpm` : String(n)
}

/** Cadence label for chart Y ticks. */
export function formatAxisRpm(rpm: number, withUnit = true): string {
  const n = Math.round(rpm)
  return withUnit ? `${n} rpm` : String(n)
}
