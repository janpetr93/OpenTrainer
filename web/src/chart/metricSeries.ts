import type { PowerProfilePoint } from '../api'

export type ChartPoint = {
  tSec: number
  value: number
}

export type ChartTone = 'planned' | 'achieved' | 'heartRate' | 'cadence' | 'meter'

/** Watts series share one Y axis (for zone bands); others scale alone. */
export type ChartScale = 'watts' | 'independent'

export type ChartSeries = {
  points: ChartPoint[]
  tone: ChartTone
  label: string
  scale: ChartScale
}

export function wattsSeries(
  points: PowerProfilePoint[],
  tone: 'planned' | 'achieved',
  label: string,
): ChartSeries | null {
  if (points.length < 2) return null
  return {
    tone,
    label,
    scale: 'watts',
    points: points.map((p) => ({ tSec: p.tSec, value: p.watts })),
  }
}

export function optionalMetricSeries(
  points: PowerProfilePoint[],
  key: 'hrBpm' | 'cadenceRpm' | 'meterWatts',
  tone: ChartTone,
  label: string,
): ChartSeries | null {
  const series = points
    .filter((p) => {
      const v = p[key]
      return v !== null && v !== undefined && Number.isFinite(v)
    })
    .map((p) => ({ tSec: p.tSec, value: p[key] as number }))
  if (series.length < 2) return null
  return {
    tone,
    label,
    scale: key === 'meterWatts' ? 'watts' : 'independent',
    points: series,
  }
}

/** Build the live-ride overlay series (plan, power, meter, HR, cadence). */
export function buildRideChartSeries(input: {
  planned: PowerProfilePoint[]
  achieved: PowerProfilePoint[]
}): ChartSeries[] {
  return [
    wattsSeries(input.planned, 'planned', 'Plan'),
    wattsSeries(input.achieved, 'achieved', 'Power'),
    optionalMetricSeries(input.achieved, 'meterWatts', 'meter', 'Meter'),
    optionalMetricSeries(input.achieved, 'hrBpm', 'heartRate', 'Heart rate'),
    optionalMetricSeries(
      input.achieved,
      'cadenceRpm',
      'cadence',
      'Cadence',
    ),
  ].filter((s): s is ChartSeries => s !== null)
}
