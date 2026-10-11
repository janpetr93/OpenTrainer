import type { PowerProfilePoint } from '../api'

export type ChartPoint = {
  tSec: number
  value: number
}

export type ChartTone = 'planned' | 'achieved' | 'heartRate' | 'cadence' | 'meter'

/** Watts share one Y axis (zone bands); HR/cadence use fixed physiological bands. */
export type ChartScale = 'watts' | 'heartRate' | 'cadence'

export type ChartSeries = {
  points: ChartPoint[]
  tone: ChartTone
  label: string
  scale: ChartScale
}

/** Fixed Y domains for body-metric scales (values outside clamp to the edge). */
export const HEART_RATE_AXIS = { min: 40, max: 200 } as const
export const CADENCE_AXIS = { min: 0, max: 120 } as const

export function chartScaleDomain(
  scale: ChartScale,
): { min: number; max: number } | null {
  switch (scale) {
    case 'heartRate':
      return { min: HEART_RATE_AXIS.min, max: HEART_RATE_AXIS.max }
    case 'cadence':
      return { min: CADENCE_AXIS.min, max: CADENCE_AXIS.max }
    case 'watts':
      return null
  }
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

function scaleForMetric(
  key: 'hrBpm' | 'cadenceRpm' | 'meterWatts' | 'trainerWatts',
): ChartScale {
  switch (key) {
    case 'hrBpm':
      return 'heartRate'
    case 'cadenceRpm':
      return 'cadence'
    case 'meterWatts':
    case 'trainerWatts':
      return 'watts'
  }
}

export function optionalMetricSeries(
  points: PowerProfilePoint[],
  key: 'hrBpm' | 'cadenceRpm' | 'meterWatts' | 'trainerWatts',
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
    scale: scaleForMetric(key),
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
    optionalMetricSeries(input.achieved, 'trainerWatts', 'meter', 'Trainer'),
    optionalMetricSeries(input.achieved, 'hrBpm', 'heartRate', 'Heart rate'),
    optionalMetricSeries(
      input.achieved,
      'cadenceRpm',
      'cadence',
      'Cadence',
    ),
  ].filter((s): s is ChartSeries => s !== null)
}

/** Partition ride series into the power chart vs the body-metric strip. */
export function splitRideChartSeries(series: ChartSeries[]): {
  power: ChartSeries[]
  body: ChartSeries[]
} {
  const power: ChartSeries[] = []
  const body: ChartSeries[] = []
  for (const s of series) {
    if (s.scale === 'watts') power.push(s)
    else body.push(s)
  }
  return { power, body }
}

/**
 * Y-axis sides for the body strip: HR left when present; cadence on the right
 * when both exist, otherwise alone on the left.
 */
export function bodyChartAxisSides(scales: Iterable<ChartScale>): {
  left: 'heartRate' | 'cadence' | null
  right: 'heartRate' | 'cadence' | null
} {
  const set = new Set(scales)
  const hasHr = set.has('heartRate')
  const hasCadence = set.has('cadence')
  if (hasHr && hasCadence) {
    return { left: 'heartRate', right: 'cadence' }
  }
  if (hasHr) return { left: 'heartRate', right: null }
  if (hasCadence) return { left: 'cadence', right: null }
  return { left: null, right: null }
}
