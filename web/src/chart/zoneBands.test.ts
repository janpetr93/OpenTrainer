import { describe, expect, it } from 'vitest'
import {
  powerAxisMaxWatts,
  wattsToY,
  zoneBandRects,
} from './zoneBands'

describe('zoneBandRects', () => {
  it('builds seven closed bands from FTP with Z7 capped at axis max', () => {
    const axisMax = powerAxisMaxWatts({ ftpWatts: 200, dataMaxWatts: 100 })
    expect(axisMax).toBe(330) // 165% of 200
    const bands = zoneBandRects(200, axisMax)
    expect(bands).toHaveLength(7)
    expect(bands[0]).toMatchObject({ zone: 1, minWatts: 0, maxWatts: 110 })
    expect(bands[3]).toMatchObject({ zone: 4, minWatts: 180, maxWatts: 210 })
    const z7 = bands[6]!
    expect(z7.zone).toBe(7)
    expect(z7.minWatts).toBe(300)
    expect(z7.maxWatts).toBe(330)
  })

  it('raises the axis when ride power exceeds the FTP floor', () => {
    expect(
      powerAxisMaxWatts({ ftpWatts: 200, dataMaxWatts: 400 }),
    ).toBe(400)
  })
})

describe('wattsToY', () => {
  it('maps axis max to the top padding and 0 W to the bottom', () => {
    expect(wattsToY(200, 200, 100, 10)).toBe(10)
    expect(wattsToY(0, 200, 100, 10)).toBe(90)
  })
})
