import { describe, expect, it } from 'vitest'
import { stravaActivityDescription } from './stravaActivityDescription'

describe('stravaActivityDescription', () => {
  it('returns undefined when there is no purpose and no Session Load', () => {
    expect(
      stravaActivityDescription({ purpose: null, sessionLoad: null }),
    ).toBeUndefined()
  })

  it('uses Session Purpose alone when Session Load is missing', () => {
    expect(
      stravaActivityDescription({
        purpose: 'Raise lactate threshold',
        sessionLoad: null,
      }),
    ).toBe('Raise lactate threshold')
  })

  it('formats Session Load as NP · IF · TSS when purpose is absent', () => {
    expect(
      stravaActivityDescription({
        purpose: null,
        sessionLoad: {
          ftpWattsAtSave: 250,
          normalizedPowerWatts: 245,
          intensityFactor: 0.89,
          trainingStressScore: 78,
          timeInZonesSec: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
        },
      }),
    ).toBe('NP 245 · IF 0.89 · TSS 78')
  })

  it('joins purpose and Session Load with a blank line', () => {
    expect(
      stravaActivityDescription({
        purpose: 'Raise lactate threshold',
        sessionLoad: {
          ftpWattsAtSave: 250,
          normalizedPowerWatts: 245,
          intensityFactor: 0.89,
          trainingStressScore: 78,
          timeInZonesSec: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
        },
      }),
    ).toBe('Raise lactate threshold\n\nNP 245 · IF 0.89 · TSS 78')
  })

  it('omits null Session Load metrics', () => {
    expect(
      stravaActivityDescription({
        purpose: null,
        sessionLoad: {
          ftpWattsAtSave: 250,
          normalizedPowerWatts: null,
          intensityFactor: null,
          trainingStressScore: 42,
          timeInZonesSec: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
        },
      }),
    ).toBe('TSS 42')
  })

  it('returns undefined when Session Load has no NP/IF/TSS', () => {
    expect(
      stravaActivityDescription({
        purpose: '  ',
        sessionLoad: {
          ftpWattsAtSave: 250,
          normalizedPowerWatts: null,
          intensityFactor: null,
          trainingStressScore: null,
          timeInZonesSec: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
        },
      }),
    ).toBeUndefined()
  })
})
