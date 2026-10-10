import { describe, expect, it } from 'vitest'
import { PowerSampler } from './powerSampler'

describe('PowerSampler', () => {
  it('records one sample per whole second and summarizes', () => {
    const sampler = new PowerSampler()
    sampler.record(0.2, { watts: 100 })
    sampler.record(0.8, { watts: 110 })
    sampler.record(1.1, { watts: 120 })
    expect(sampler.getProfile()).toEqual([
      { tSec: 0, watts: 110 },
      { tSec: 1, watts: 120 },
    ])
    expect(sampler.summarize()).toEqual({
      averagePowerWatts: 115,
      maxPowerWatts: 120,
      durationSec: 1,
    })
  })

  it('attaches optional HR, cadence, and meter watts when provided', () => {
    const sampler = new PowerSampler()
    sampler.record(0, {
      watts: 200,
      hrBpm: 148,
      cadenceRpm: 88,
      meterWatts: 205,
    })
    sampler.record(1, { watts: 210, hrBpm: 150 })
    expect(sampler.getProfile()).toEqual([
      { tSec: 0, watts: 200, hrBpm: 148, cadenceRpm: 88, meterWatts: 205 },
      { tSec: 1, watts: 210, hrBpm: 150 },
    ])
  })

  it('omits null optional sensors from the sample', () => {
    const sampler = new PowerSampler()
    sampler.record(0, { watts: 180, hrBpm: null, cadenceRpm: null })
    expect(sampler.getProfile()).toEqual([{ tSec: 0, watts: 180 }])
  })
})
