import { describe, expect, it } from 'vitest'
import {
  buildPlannedPowerProfile,
  truncatePowerProfile,
} from './plannedPowerProfile'

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

  it('leaves a gap for an Open Step', () => {
    const points = buildPlannedPowerProfile([
      {
        type: 'warmup',
        durationSec: 60,
        targetWatts: 100,
        percentFtp: null,
        zone: null,
      },
      {
        type: 'open',
        durationSec: 120,
        targetWatts: null,
        percentFtp: null,
        zone: null,
      },
      {
        type: 'cooldown',
        durationSec: 60,
        targetWatts: 80,
        percentFtp: null,
        zone: null,
      },
    ])
    expect(points).toEqual([
      { tSec: 0, watts: 100 },
      { tSec: 60, watts: 100 },
      { tSec: 60, watts: null },
      { tSec: 180, watts: null },
      { tSec: 180, watts: 80 },
      { tSec: 240, watts: 80 },
    ])
  })
})

describe('truncatePowerProfile', () => {
  const plan = [
    { tSec: 0, watts: 100 },
    { tSec: 60, watts: 100 },
    { tSec: 60, watts: 200 },
    { tSec: 180, watts: 200 },
  ]

  it('ends the step that spans the cut at the cut', () => {
    expect(truncatePowerProfile(plan, 90)).toEqual([
      { tSec: 0, watts: 100 },
      { tSec: 60, watts: 100 },
      { tSec: 60, watts: 200 },
      { tSec: 90, watts: 200 },
    ])
  })

  it('drops a step that starts at the cut', () => {
    expect(truncatePowerProfile(plan, 60)).toEqual([
      { tSec: 0, watts: 100 },
      { tSec: 60, watts: 100 },
    ])
  })

  it('returns the whole plan when the cut is at or past its end', () => {
    expect(truncatePowerProfile(plan, 180)).toEqual(plan)
    expect(truncatePowerProfile(plan, 500)).toEqual(plan)
  })

  it('returns nothing for a cut at 0 s', () => {
    expect(truncatePowerProfile(plan, 0)).toEqual([])
  })
})
