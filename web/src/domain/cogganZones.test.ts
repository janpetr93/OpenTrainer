import { describe, expect, it } from 'vitest'
import { zonesFromFtp } from './cogganZones'

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
