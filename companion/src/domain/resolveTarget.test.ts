import { describe, expect, it } from 'vitest'
import { resolveStepWatts } from './resolveTarget.js'

describe('resolveStepWatts', () => {
  it('prefers absolute targetWatts', () => {
    expect(
      resolveStepWatts(
        {
          type: 'steady',
          durationSec: 60,
          targetWatts: 200,
          percentFtp: 90,
          zone: 4,
        },
        250,
      ),
    ).toBe(200)
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
    const watts = resolveStepWatts(
      {
        type: 'steady',
        durationSec: 60,
        targetWatts: null,
        percentFtp: null,
        zone: 2,
      },
      200,
    )
    expect(watts).toBe(130) // (110+150)/2
  })
})
