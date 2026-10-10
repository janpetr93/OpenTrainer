import { describe, expect, it } from 'vitest'
import { computeAverageAlignmentDeltaWatts } from './powerAlignment.js'
import type { PowerProfilePoint } from './types.js'

describe('computeAverageAlignmentDeltaWatts', () => {
  it('returns null when no samples have meterWatts', () => {
    const profile: PowerProfilePoint[] = [
      { tSec: 0, watts: 200 },
      { tSec: 1, watts: 210 },
    ]
    expect(computeAverageAlignmentDeltaWatts(profile)).toBeNull()
  })

  it('averages Meter − Trainer only on paired samples', () => {
    const profile: PowerProfilePoint[] = [
      { tSec: 0, watts: 200, meterWatts: 210 },
      { tSec: 1, watts: 200 },
      { tSec: 2, watts: 220, meterWatts: 230 },
      { tSec: 3, watts: 200, meterWatts: null },
    ]
    // deltas: +10, +10 → average +10
    expect(computeAverageAlignmentDeltaWatts(profile)).toBe(10)
  })

  it('rounds to nearest watt', () => {
    const profile: PowerProfilePoint[] = [
      { tSec: 0, watts: 200, meterWatts: 205 },
      { tSec: 1, watts: 200, meterWatts: 206 },
    ]
    // (+5 + +6) / 2 = 5.5 → 6
    expect(computeAverageAlignmentDeltaWatts(profile)).toBe(6)
  })
})
