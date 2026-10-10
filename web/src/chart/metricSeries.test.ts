import { describe, expect, it } from 'vitest'
import { buildRideChartSeries } from './metricSeries'

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
