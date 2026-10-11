import type { ChartPoint } from './metricSeries'

/**
 * Centered moving average over points whose tSec falls within ±windowSec/2.
 * Display-only helper — does not alter stored Power Profile samples.
 */
export function smoothChartPoints(
  points: ChartPoint[],
  windowSec = 5,
): ChartPoint[] {
  if (points.length < 2 || windowSec <= 0) {
    return points.map((p) => ({ ...p }))
  }
  const half = windowSec / 2
  return points.map((p) => {
    let sum = 0
    let n = 0
    for (const q of points) {
      if (Math.abs(q.tSec - p.tSec) <= half) {
        sum += q.value
        n += 1
      }
    }
    return { tSec: p.tSec, value: n > 0 ? sum / n : p.value }
  })
}
