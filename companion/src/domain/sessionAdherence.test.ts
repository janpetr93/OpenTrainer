import { describe, expect, it } from 'vitest'
import { computeSessionAdherence } from './sessionAdherence.js'
import type { PowerProfilePoint } from './types.js'

function profile(watts: number, durationSec: number): PowerProfilePoint[] {
  return Array.from({ length: durationSec }, (_, tSec) => ({ tSec, watts }))
}

describe('computeSessionAdherence', () => {
  it('returns null for Free Ride (no planned profile)', () => {
    expect(computeSessionAdherence(profile(200, 60), null)).toBeNull()
    expect(computeSessionAdherence(profile(200, 60), [])).toBeNull()
  })

  it('reports full completion and adherence when achieved matches plan', () => {
    const planned = profile(200, 100)
    const achieved = profile(200, 100)
    const a = computeSessionAdherence(achieved, planned)
    expect(a).toEqual({
      completionRatio: 1,
      targetAdherence: 1,
    })
  })

  it('caps completion at 1 when ridden longer than plan', () => {
    const a = computeSessionAdherence(profile(200, 150), profile(200, 100))
    expect(a!.completionRatio).toBe(1)
  })

  it('scores prescribed seconds only and still counts Open Step time toward completion', () => {
    const planned: PowerProfilePoint[] = [
      { tSec: 0, watts: 200 },
      { tSec: 10, watts: 200 },
      { tSec: 10, watts: null },
      { tSec: 20, watts: null },
      { tSec: 20, watts: 100 },
      { tSec: 30, watts: 100 },
    ]
    const achieved = [
      ...Array.from({ length: 10 }, (_, tSec) => ({ tSec, watts: 200 })),
      ...Array.from({ length: 10 }, (_, i) => ({ tSec: 10 + i, watts: 999 })),
      ...Array.from({ length: 11 }, (_, i) => ({ tSec: 20 + i, watts: 100 })),
    ]
    const adherence = computeSessionAdherence(achieved, planned)
    expect(adherence).toEqual({ completionRatio: 1, targetAdherence: 1 })
  })

  it('counts on-target within max(15% of planned, 20W) band', () => {
    // planned 200 → band = max(30, 20) = 30W; 225 is inside, 240 is outside
    expect(
      computeSessionAdherence(profile(225, 40), profile(200, 40))!
        .targetAdherence,
    ).toBe(1)
    expect(
      computeSessionAdherence(profile(240, 40), profile(200, 40))!
        .targetAdherence,
    ).toBe(0)
  })

  it('scores a 5s average so wobble around the target counts as on target', () => {
    // 137 W → band 20.55 W. Raw ±25 W is outside the band; the 5s mean is the target.
    const achieved = Array.from({ length: 30 }, (_, tSec) => ({
      tSec,
      watts: 137 + (tSec % 2 === 0 ? 25 : -25),
    }))
    expect(
      computeSessionAdherence(achieved, profile(137, 30))!.targetAdherence,
    ).toBe(1)
  })

  it('does not average achieved watts across a target change', () => {
    const planned: PowerProfilePoint[] = [
      { tSec: 0, watts: 50 },
      { tSec: 5, watts: 50 },
      { tSec: 5, watts: 200 },
      { tSec: 10, watts: 200 },
    ]
    const achieved = [
      ...Array.from({ length: 5 }, (_, tSec) => ({ tSec, watts: 50 })),
      ...Array.from({ length: 6 }, (_, i) => ({ tSec: 5 + i, watts: 200 })),
    ]
    expect(computeSessionAdherence(achieved, planned)!.targetAdherence).toBe(1)
  })

  it('does not smooth a target that changes every second', () => {
    const points = Array.from({ length: 20 }, (_, tSec) => ({
      tSec,
      watts: tSec % 2 === 0 ? 50 : 300,
    }))
    expect(computeSessionAdherence(points, points)!.targetAdherence).toBe(1)
  })

  it('still misses a sustained hold outside the band', () => {
    expect(
      computeSessionAdherence(profile(160, 40), profile(200, 40))!
        .targetAdherence,
    ).toBe(0)
  })

  it('uses 20W floor when planned is low', () => {
    // planned 50 → 15% = 7.5, band = 20W; 65 is on-target
    const a = computeSessionAdherence(profile(65, 40), profile(50, 40))
    expect(a!.targetAdherence).toBe(1)
  })

  it('expands sparse planned step corners to 1 Hz before scoring', () => {
    // Same shape as buildPlannedPowerProfile: start/end pairs per step.
    const planned: PowerProfilePoint[] = [
      { tSec: 0, watts: 100 },
      { tSec: 10, watts: 100 },
      { tSec: 10, watts: 148 },
      { tSec: 30, watts: 148 },
      { tSec: 30, watts: 90 },
      { tSec: 40, watts: 90 },
    ]
    const achieved = [
      ...Array.from({ length: 10 }, (_, tSec) => ({ tSec, watts: 100 })),
      ...Array.from({ length: 20 }, (_, i) => ({ tSec: 10 + i, watts: 148 })),
      ...Array.from({ length: 11 }, (_, i) => ({ tSec: 30 + i, watts: 90 })),
    ]
    const a = computeSessionAdherence(achieved, planned)
    expect(a).toEqual({
      completionRatio: 1,
      targetAdherence: 1,
    })
  })

  it('scores against the ridden targets when the rider changed Ride Intensity', () => {
    // Planned 280 W, rider dialled to 80% and held 224 W in ERG.
    const a = computeSessionAdherence(
      profile(224, 100),
      profile(280, 100),
      profile(224, 100),
    )
    expect(a).toEqual({
      completionRatio: 1,
      targetAdherence: 1,
      intensityPercent: 80,
    })
  })

  it('weights intensity by planned watts over the seconds ridden', () => {
    const planned: PowerProfilePoint[] = [
      { tSec: 0, watts: 140 },
      { tSec: 60, watts: 140 },
      { tSec: 60, watts: 280 },
      { tSec: 120, watts: 280 },
    ]
    const target: PowerProfilePoint[] = [
      { tSec: 0, watts: 140 },
      { tSec: 60, watts: 140 },
      { tSec: 60, watts: 224 },
      { tSec: 120, watts: 224 },
    ]
    // (60×140 + 60×224) / (60×140 + 60×280) = 21840 / 25200
    const full = computeSessionAdherence(profile(200, 120), planned, target)
    expect(full!.intensityPercent).toBe(87)

    // Stopped before the dialled-down step: everything ridden was at 100%.
    const early = computeSessionAdherence(profile(140, 60), planned, target)
    expect(early!.intensityPercent).toBe(100)
    expect(early!.completionRatio).toBe(0.496)
  })

  it('omits intensity when there is no target profile', () => {
    const a = computeSessionAdherence(profile(200, 60), profile(200, 60), null)
    expect(a).not.toHaveProperty('intensityPercent')
  })

  it('stays null for a Free Ride with targets but no plan', () => {
    expect(
      computeSessionAdherence(profile(150, 60), null, profile(150, 60)),
    ).toBeNull()
  })

  it('scores only the plan when ridden targets run past it', () => {
    // 60 s plan at 200 W, then 60 s of Free Ride held at 120 W in ERG.
    const target: PowerProfilePoint[] = [
      { tSec: 0, watts: 200 },
      { tSec: 60, watts: 200 },
      { tSec: 60, watts: 120 },
      { tSec: 120, watts: 120 },
    ]
    const achieved = [...profile(200, 60), ...profile(300, 60)].map(
      (point, tSec) => ({ ...point, tSec }),
    )
    const a = computeSessionAdherence(achieved, profile(200, 60), target)
    expect(a).toEqual({
      completionRatio: 1,
      targetAdherence: 1,
      intensityPercent: 100,
    })
  })
})
