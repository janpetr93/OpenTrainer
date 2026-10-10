import { describe, expect, it } from 'vitest'
import { buildPlannedPowerProfile } from './plannedPowerProfile.js'

const watts = (
  type: 'warmup' | 'steady' | 'recovery' | 'cooldown',
  durationSec: number,
  targetWatts: number | null,
) => ({
  type,
  durationSec,
  targetWatts,
  percentFtp: null,
  zone: null,
})

describe('buildPlannedPowerProfile', () => {
  it('builds a step Power Profile from Workout steps', () => {
    const profile = buildPlannedPowerProfile([
      watts('warmup', 60, 100),
      watts('steady', 120, 200),
      watts('cooldown', 60, 80),
    ])

    expect(profile).toEqual([
      { tSec: 0, watts: 100 },
      { tSec: 60, watts: 100 },
      { tSec: 60, watts: 200 },
      { tSec: 180, watts: 200 },
      { tSec: 180, watts: 80 },
      { tSec: 240, watts: 80 },
    ])
  })

  it('uses 0 W when targetWatts is null', () => {
    const profile = buildPlannedPowerProfile([watts('recovery', 30, null)])
    expect(profile).toEqual([
      { tSec: 0, watts: 0 },
      { tSec: 30, watts: 0 },
    ])
  })

  it('resolves percentFtp when FTP is provided', () => {
    const profile = buildPlannedPowerProfile(
      [
        {
          type: 'steady',
          durationSec: 60,
          targetWatts: null,
          percentFtp: 100,
          zone: null,
        },
      ],
      220,
    )
    expect(profile).toEqual([
      { tSec: 0, watts: 220 },
      { tSec: 60, watts: 220 },
    ])
  })
})
