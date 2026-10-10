import { describe, expect, it } from 'vitest'
import {
  AlignmentDeltaAverager,
  ALIGNMENT_AVERAGE_WINDOW_MS,
  formatAlignmentDelta,
  powerAlignmentDelta,
} from './powerAlignment'

describe('powerAlignmentDelta', () => {
  it('returns Meter Power minus Live Power when both are fresh', () => {
    expect(
      powerAlignmentDelta({
        trainerWatts: 200,
        trainerStatus: 'fresh',
        meterWatts: 215,
        meterStatus: 'fresh',
      }),
    ).toBe(15)
  })

  it('returns null when either stream is missing or stale', () => {
    expect(
      powerAlignmentDelta({
        trainerWatts: 200,
        trainerStatus: 'fresh',
        meterWatts: 215,
        meterStatus: 'stale',
      }),
    ).toBeNull()
    expect(
      powerAlignmentDelta({
        trainerWatts: null,
        trainerStatus: 'missing',
        meterWatts: 215,
        meterStatus: 'fresh',
      }),
    ).toBeNull()
  })
})

describe('AlignmentDeltaAverager', () => {
  it('averages instantaneous deltas over the 5s window', () => {
    const avg = new AlignmentDeltaAverager()
    avg.sample({
      trainerWatts: 200,
      trainerStatus: 'fresh',
      meterWatts: 210,
      meterStatus: 'fresh',
      nowMs: 1000,
    })
    avg.sample({
      trainerWatts: 200,
      trainerStatus: 'fresh',
      meterWatts: 220,
      meterStatus: 'fresh',
      nowMs: 2000,
    })
    expect(
      avg.sample({
        trainerWatts: 200,
        trainerStatus: 'fresh',
        meterWatts: 230,
        meterStatus: 'fresh',
        nowMs: 3000,
      }),
    ).toBe(20) // (10+20+30)/3
  })

  it('drops samples older than the window', () => {
    const avg = new AlignmentDeltaAverager()
    avg.sample({
      trainerWatts: 200,
      trainerStatus: 'fresh',
      meterWatts: 250,
      meterStatus: 'fresh',
      nowMs: 0,
    })
    expect(
      avg.sample({
        trainerWatts: 200,
        trainerStatus: 'fresh',
        meterWatts: 210,
        meterStatus: 'fresh',
        nowMs: ALIGNMENT_AVERAGE_WINDOW_MS + 1,
      }),
    ).toBe(10)
  })

  it('keeps the windowed average through a brief stale gap', () => {
    const avg = new AlignmentDeltaAverager()
    avg.sample({
      trainerWatts: 200,
      trainerStatus: 'fresh',
      meterWatts: 210,
      meterStatus: 'fresh',
      nowMs: 1000,
    })
    expect(
      avg.sample({
        trainerWatts: 200,
        trainerStatus: 'stale',
        meterWatts: 210,
        meterStatus: 'fresh',
        nowMs: 1500,
      }),
    ).toBe(10)
  })

  it('returns null once the window empties', () => {
    const avg = new AlignmentDeltaAverager()
    avg.sample({
      trainerWatts: 200,
      trainerStatus: 'fresh',
      meterWatts: 210,
      meterStatus: 'fresh',
      nowMs: 0,
    })
    expect(
      avg.sample({
        trainerWatts: 200,
        trainerStatus: 'stale',
        meterWatts: 210,
        meterStatus: 'fresh',
        nowMs: ALIGNMENT_AVERAGE_WINDOW_MS + 1,
      }),
    ).toBeNull()
  })
})

describe('formatAlignmentDelta', () => {
  it('formats signed watts', () => {
    expect(formatAlignmentDelta(12)).toBe('+12 W')
    expect(formatAlignmentDelta(-3)).toBe('-3 W')
    expect(formatAlignmentDelta(null)).toBe('—')
  })
})
