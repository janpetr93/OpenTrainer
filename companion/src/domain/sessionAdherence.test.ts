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

  it('counts on-target within max(15% of planned, 20W) band', () => {
    // planned 200 → band = max(30, 20) = 30W; 225 is inside, 240 is outside
    const planned = profile(200, 100)
    const achieved = [
      ...Array.from({ length: 50 }, (_, tSec) => ({ tSec, watts: 225 })),
      ...Array.from({ length: 50 }, (_, tSec) => ({
        tSec: tSec + 50,
        watts: 240,
      })),
    ]
    const a = computeSessionAdherence(achieved, planned)
    expect(a!.targetAdherence).toBe(0.5)
  })

  it('uses 20W floor when planned is low', () => {
    // planned 50 → 15% = 7.5, band = 20W; 65 is on-target
    const a = computeSessionAdherence(profile(65, 40), profile(50, 40))
    expect(a!.targetAdherence).toBe(1)
  })
})
