import { describe, expect, it } from 'vitest'
import { smoothChartPoints } from './smoothSeries'

describe('smoothChartPoints', () => {
  it('applies a centered 5s average on 1 Hz samples', () => {
    const points = [
      { tSec: 0, value: 100 },
      { tSec: 1, value: 100 },
      { tSec: 2, value: 200 },
      { tSec: 3, value: 100 },
      { tSec: 4, value: 100 },
    ]
    const smoothed = smoothChartPoints(points, 5)
    // Center at t=2 uses t=0..4 → (100+100+200+100+100)/5
    expect(smoothed[2]).toEqual({ tSec: 2, value: 120 })
    // Edge at t=0 uses t=0..2 → (100+100+200)/3
    expect(smoothed[0]).toEqual({ tSec: 0, value: 400 / 3 })
  })

  it('leaves a single point unchanged', () => {
    expect(smoothChartPoints([{ tSec: 0, value: 150 }], 5)).toEqual([
      { tSec: 0, value: 150 },
    ])
  })

  it('does not mutate the input', () => {
    const points = [
      { tSec: 0, value: 10 },
      { tSec: 1, value: 20 },
    ]
    const copy = points.map((p) => ({ ...p }))
    smoothChartPoints(points, 5)
    expect(points).toEqual(copy)
  })
})
