import { describe, expect, it } from 'vitest'
import { samplePowerMetrics } from './samplePowerMetrics'

describe('samplePowerMetrics', () => {
  it('in trainer-primary uses Trainer watts and optional meterWatts', () => {
    expect(
      samplePowerMetrics({
        mode: 'trainer',
        trainerWatts: 145,
        trainerFresh: true,
        meterWatts: 122,
        meterFresh: true,
      }),
    ).toEqual({ watts: 145, trainerWatts: null, meterWatts: 122 })
  })

  it('in trainer-primary omits meter when not fresh', () => {
    expect(
      samplePowerMetrics({
        mode: 'trainer',
        trainerWatts: 145,
        trainerFresh: true,
        meterWatts: 122,
        meterFresh: false,
      }),
    ).toEqual({ watts: 145, trainerWatts: null, meterWatts: null })
  })

  it('in meter-primary uses Assioma as watts and D100 as trainerWatts', () => {
    expect(
      samplePowerMetrics({
        mode: 'meter',
        trainerWatts: 145,
        trainerFresh: true,
        meterWatts: 122,
        meterFresh: true,
      }),
    ).toEqual({ watts: 122, trainerWatts: 145, meterWatts: null })
  })

  it('in meter-primary yields no primary watts when meter is stale', () => {
    expect(
      samplePowerMetrics({
        mode: 'meter',
        trainerWatts: 145,
        trainerFresh: true,
        meterWatts: 122,
        meterFresh: false,
      }),
    ).toEqual({ watts: null, trainerWatts: 145, meterWatts: null })
  })

  it('in trainer-primary yields no watts when trainer is stale', () => {
    expect(
      samplePowerMetrics({
        mode: 'trainer',
        trainerWatts: 145,
        trainerFresh: false,
        meterWatts: 122,
        meterFresh: true,
      }),
    ).toEqual({ watts: null, trainerWatts: null, meterWatts: 122 })
  })
})
