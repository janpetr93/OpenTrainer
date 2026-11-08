import { describe, expect, it } from 'vitest'
import { zoneForWatts, zonesFromFtp } from './cogganZones'

describe('zonesFromFtp', () => {
  it('derives seven Coggan bands from FTP', () => {
    const zones = zonesFromFtp(200)
    expect(zones).toHaveLength(7)
    expect(zones[1]).toMatchObject({
      zone: 2,
      minWatts: 110,
      maxWatts: 150,
    })
    expect(zones[3]?.zone).toBe(4)
    expect(zones[3]?.targetWatts).toBeGreaterThan(180)
    expect(zones[3]?.targetWatts).toBeLessThan(210)
  })
})

describe('zoneForWatts', () => {
  it('puts a watt value in the zone whose edge it has reached', () => {
    expect(zoneForWatts(200, 100)).toBe(1)
    expect(zoneForWatts(200, 110)).toBe(2)
    expect(zoneForWatts(200, 400)).toBe(7)
  })
})
