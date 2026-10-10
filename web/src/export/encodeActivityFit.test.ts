import { describe, expect, it } from 'vitest'
import { encodeActivityFit } from './encodeActivityFit'
import type { Activity } from '../api'

const sampleActivity: Activity = {
  id: 'a1',
  startedAt: '2026-10-09T10:00:00.000Z',
  durationSec: 5,
  averagePowerWatts: 150,
  maxPowerWatts: 180,
  achievedPowerProfile: [
    { tSec: 0, watts: 140 },
    { tSec: 1, watts: 150 },
    { tSec: 2, watts: 160 },
    { tSec: 3, watts: 170 },
    { tSec: 4, watts: 180 },
    { tSec: 5, watts: 175 },
  ],
  plannedPowerProfile: [
    { tSec: 0, watts: 150 },
    { tSec: 5, watts: 150 },
  ],
  workoutId: 'w1',
}

describe('encodeActivityFit', () => {
  it('produces a FIT file with a valid header signature', () => {
    const bytes = encodeActivityFit(sampleActivity)
    expect(bytes.byteLength).toBeGreaterThan(30)
    expect(bytes[0]).toBe(14) // header size
    const sig = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!)
    expect(sig).toBe('.FIT')
  })

  it('refuses to invent an empty Activity', () => {
    expect(() =>
      encodeActivityFit({
        ...sampleActivity,
        achievedPowerProfile: [],
        durationSec: 0,
      }),
    ).toThrow(/power/i)
  })
})
