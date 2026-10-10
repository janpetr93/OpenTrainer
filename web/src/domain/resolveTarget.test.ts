import { describe, expect, it } from 'vitest'
import { resolveStepWatts, workoutNeedsFtp } from './resolveTarget'

describe('resolveStepWatts', () => {
  it('prefers absolute targetWatts', () => {
    expect(
      resolveStepWatts(
        {
          type: 'steady',
          durationSec: 60,
          targetWatts: 220,
          percentFtp: 90,
          zone: 4,
        },
        200,
      ),
    ).toBe(220)
  })

  it('resolves percentFtp from FTP', () => {
    expect(
      resolveStepWatts(
        {
          type: 'steady',
          durationSec: 60,
          targetWatts: null,
          percentFtp: 90,
          zone: null,
        },
        200,
      ),
    ).toBe(180)
  })

  it('resolves zone midpoint from FTP', () => {
    expect(
      resolveStepWatts(
        {
          type: 'steady',
          durationSec: 60,
          targetWatts: null,
          percentFtp: null,
          zone: 2,
        },
        200,
      ),
    ).toBe(130)
  })

  it('throws when FTP missing for percentFtp', () => {
    expect(() =>
      resolveStepWatts(
        {
          type: 'steady',
          durationSec: 60,
          targetWatts: null,
          percentFtp: 90,
          zone: null,
        },
        null,
      ),
    ).toThrow(/FTP required/)
  })
})

describe('workoutNeedsFtp', () => {
  it('is false for absolute-watts-only workouts', () => {
    expect(
      workoutNeedsFtp([
        {
          type: 'steady',
          durationSec: 60,
          targetWatts: 200,
          percentFtp: null,
          zone: null,
        },
      ]),
    ).toBe(false)
  })

  it('is true when any step uses zone or percentFtp', () => {
    expect(
      workoutNeedsFtp([
        {
          type: 'steady',
          durationSec: 60,
          targetWatts: null,
          percentFtp: null,
          zone: 4,
        },
      ]),
    ).toBe(true)
  })
})
