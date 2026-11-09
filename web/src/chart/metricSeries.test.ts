import { describe, expect, it } from 'vitest'
import {
  bodyChartAxisSides,
  buildRideChartSeries,
  chartRuns,
  chartScaleDomain,
  openWavePoints,
  splitRideChartSeries,
} from './metricSeries'

describe('buildRideChartSeries', () => {
  it('includes power, HR, and cadence when samples carry them', () => {
    const series = buildRideChartSeries({
      planned: [
        { tSec: 0, watts: 100 },
        { tSec: 60, watts: 100 },
      ],
      achieved: [
        { tSec: 0, watts: 140, hrBpm: 120, cadenceRpm: 80, meterWatts: 145 },
        { tSec: 1, watts: 150, hrBpm: 125, cadenceRpm: 82, meterWatts: 155 },
        { tSec: 2, watts: 160, hrBpm: 130, cadenceRpm: 85 },
      ],
    })
    expect(series.map((s) => s.tone)).toEqual([
      'planned',
      'achieved',
      'meter',
      'heartRate',
      'cadence',
    ])
    expect(series.find((s) => s.tone === 'heartRate')?.scale).toBe('heartRate')
    expect(series.find((s) => s.tone === 'cadence')?.scale).toBe('cadence')
    expect(series.find((s) => s.tone === 'meter')?.scale).toBe('watts')
  })

  it('adds a Target line for ridden targets after the plan', () => {
    const series = buildRideChartSeries({
      planned: [
        { tSec: 0, watts: 280 },
        { tSec: 60, watts: 280 },
      ],
      target: [
        { tSec: 0, watts: 224 },
        { tSec: 60, watts: 224 },
      ],
      achieved: [
        { tSec: 0, watts: 220 },
        { tSec: 1, watts: 225 },
      ],
    })
    expect(series.map((s) => [s.tone, s.label])).toEqual([
      ['planned', 'Plan'],
      ['target', 'Target'],
      ['achieved', 'Power'],
    ])
    expect(series.find((s) => s.tone === 'target')?.scale).toBe('watts')
  })

  it('omits optional metrics when fewer than two points exist', () => {
    const series = buildRideChartSeries({
      planned: [],
      achieved: [
        { tSec: 0, watts: 140, hrBpm: 120 },
        { tSec: 1, watts: 150 },
      ],
    })
    expect(series.map((s) => s.tone)).toEqual(['achieved'])
  })
})

describe('chartScaleDomain', () => {
  it('returns fixed HR and cadence bands', () => {
    expect(chartScaleDomain('heartRate')).toEqual({ min: 40, max: 200 })
    expect(chartScaleDomain('cadence')).toEqual({ min: 0, max: 120 })
  })

  it('returns null for watts (domain comes from FTP/data)', () => {
    expect(chartScaleDomain('watts')).toBeNull()
  })
})

describe('splitRideChartSeries', () => {
  it('puts watts on power and HR/cadence on body', () => {
    const series = buildRideChartSeries({
      planned: [
        { tSec: 0, watts: 100 },
        { tSec: 60, watts: 100 },
      ],
      achieved: [
        { tSec: 0, watts: 140, hrBpm: 120, cadenceRpm: 80, meterWatts: 145 },
        { tSec: 1, watts: 150, hrBpm: 125, cadenceRpm: 82, meterWatts: 155 },
      ],
    })
    const { power, body } = splitRideChartSeries(series)
    expect(power.map((s) => s.tone)).toEqual(['planned', 'achieved', 'meter'])
    expect(body.map((s) => s.tone)).toEqual(['heartRate', 'cadence'])
  })

  it('leaves body empty when only power series exist', () => {
    const { power, body } = splitRideChartSeries([
      {
        tone: 'achieved',
        label: 'Power',
        scale: 'watts',
        points: [
          { tSec: 0, value: 100 },
          { tSec: 1, value: 110 },
        ],
      },
    ])
    expect(power).toHaveLength(1)
    expect(body).toEqual([])
  })
})

describe('chartRuns', () => {
  it('breaks the plan line across an Open Step', () => {
    const series = buildRideChartSeries({
      planned: [
        { tSec: 0, watts: 100 },
        { tSec: 60, watts: 100 },
        { tSec: 60, watts: null },
        { tSec: 180, watts: null },
        { tSec: 180, watts: 80 },
        { tSec: 240, watts: 80 },
      ],
      achieved: [],
    })
    const planned = series.find((s) => s.tone === 'planned')
    expect(chartRuns(planned!.points)).toEqual([
      [
        { tSec: 0, value: 100 },
        { tSec: 60, value: 100 },
      ],
      [
        { tSec: 180, value: 80 },
        { tSec: 240, value: 80 },
      ],
    ])
  })

  it('draws an Open Step as a wave instead of a flat watt line', () => {
    const points = openWavePoints({ t0: 60, t1: 210 }, 0, 200)
    const values = points.map((point) => point.value)
    expect(points[0]?.tSec).toBe(60)
    expect(points.at(-1)?.tSec).toBe(210)
    const swing = Math.max(...values) - Math.min(...values)
    expect(swing).toBeGreaterThan(30)
    expect(swing).toBeLessThan(50)
    expect(new Set(values.map((value) => Math.round(value))).size).toBeGreaterThan(4)
  })
})

describe('bodyChartAxisSides', () => {
  it('puts HR left and cadence right when both are present', () => {
    expect(bodyChartAxisSides(['heartRate', 'cadence'])).toEqual({
      left: 'heartRate',
      right: 'cadence',
    })
  })

  it('puts a single body scale on the left', () => {
    expect(bodyChartAxisSides(['cadence'])).toEqual({
      left: 'cadence',
      right: null,
    })
    expect(bodyChartAxisSides(['heartRate'])).toEqual({
      left: 'heartRate',
      right: null,
    })
  })
})
