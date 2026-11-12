import { describe, expect, it } from 'vitest'
import { computeExternalLoad } from './externalLoad.js'

describe('computeExternalLoad', () => {
  it('computes rTSS from avg pace and Threshold Pace (pace-first)', () => {
    // Threshold 4:53/km = 293 s/km; avg 5:20/km = 320 s/km
    // IF = 293/320 = 0.915625; hours = 50/60; TSS = hours * IF^2 * 100 ≈ 69.9
    const result = computeExternalLoad({
      durationMin: 50,
      averagePaceSecPerKm: 320,
      averageHrBpm: 160,
      runThresholdPaceSecPerKm: 293,
      lthrBpm: 170,
    })
    expect(result.method).toBe('rTSS')
    expect(result.trainingStressScore).toBe(69.9)
  })

  it('falls back to hrTSS when pace or Threshold Pace is missing', () => {
    // IF = 150/170; hours = 44/60; TSS = hours * IF^2 * 100 ≈ 57.2
    const result = computeExternalLoad({
      durationMin: 44,
      averageHrBpm: 150,
      lthrBpm: 170,
    })
    expect(result.method).toBe('hrTSS')
    expect(result.trainingStressScore).toBe(57.1)
  })

  it('uses duration × effort when physiology metrics are missing', () => {
    expect(
      computeExternalLoad({ durationMin: 60, effort: 'easy' }).trainingStressScore,
    ).toBe(36)
    expect(
      computeExternalLoad({ durationMin: 60, effort: 'steady' }).method,
    ).toBe('duration')
    expect(
      computeExternalLoad({ durationMin: 60 }).trainingStressScore,
    ).toBe(48)
  })

  it('honors an explicit trainingStressScore override', () => {
    const result = computeExternalLoad({
      durationMin: 50,
      trainingStressScore: 88,
      averagePaceSecPerKm: 320,
      runThresholdPaceSecPerKm: 293,
    })
    expect(result.method).toBe('override')
    expect(result.trainingStressScore).toBe(88)
  })
})
