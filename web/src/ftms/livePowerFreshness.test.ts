import { describe, expect, it } from 'vitest'
import {
  STALE_POWER_MS,
  livePowerStatus,
} from './livePowerFreshness'

describe('livePowerStatus', () => {
  it('is missing when no sample has arrived', () => {
    expect(livePowerStatus({ lastSampleAtMs: null, nowMs: 1000, watts: null })).toBe(
      'missing',
    )
  })

  it('is fresh when a sample arrived within the freshness window', () => {
    expect(
      livePowerStatus({
        lastSampleAtMs: 1000,
        nowMs: 1000 + STALE_POWER_MS - 1,
        watts: 200,
      }),
    ).toBe('fresh')
  })

  it('is stale when the freshness window has elapsed', () => {
    expect(
      livePowerStatus({
        lastSampleAtMs: 1000,
        nowMs: 1000 + STALE_POWER_MS,
        watts: 200,
      }),
    ).toBe('stale')
  })
})
