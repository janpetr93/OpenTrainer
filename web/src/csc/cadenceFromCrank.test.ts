import { describe, expect, it } from 'vitest'
import { cadenceRpmFromCrankDelta } from './cadenceFromCrank'

describe('cadenceRpmFromCrankDelta', () => {
  it('computes rpm from crank rev and event-time deltas (1/1024 s)', () => {
    // 2 revs in 1.0 s → 120 rpm
    expect(
      cadenceRpmFromCrankDelta({
        revDelta: 2,
        timeDeltaTicks: 1024,
      }),
    ).toBe(120)
  })

  it('returns null when time did not advance', () => {
    expect(
      cadenceRpmFromCrankDelta({ revDelta: 1, timeDeltaTicks: 0 }),
    ).toBeNull()
  })
})
