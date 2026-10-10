import { describe, expect, it } from 'vitest'
import { buildPlannedPowerProfile } from './plannedPowerProfile'

describe('buildPlannedPowerProfile', () => {
  it('builds step edges for absolute watts', () => {
    const points = buildPlannedPowerProfile([
      {
        type: 'warmup',
        durationSec: 60,
        targetWatts: 100,
        percentFtp: null,
        zone: null,
      },
      {
        type: 'steady',
        durationSec: 120,
        targetWatts: 200,
        percentFtp: null,
        zone: null,
      },
    ])
    expect(points).toEqual([
      { tSec: 0, watts: 100 },
      { tSec: 60, watts: 100 },
      { tSec: 60, watts: 200 },
      { tSec: 180, watts: 200 },
    ])
  })

  it('resolves percentFtp when FTP is provided', () => {
    const points = buildPlannedPowerProfile(
      [
        {
          type: 'steady',
          durationSec: 60,
          targetWatts: null,
          percentFtp: 100,
          zone: null,
        },
      ],
      250,
    )
    expect(points[0]?.watts).toBe(250)
  })
})
