import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ERG_CALIBRATION,
  adaptErgCalibration,
  resolveErgSetpoint,
  type ErgCalibration,
} from './ergCalibration'

describe('resolveErgSetpoint', () => {
  it('maps meter target through scale (Meter/Trainer ratio) with no trim when meter stale', () => {
    const cal: ErgCalibration = { scale: 0.85, offsetWatts: 0 }
    expect(
      resolveErgSetpoint({
        meterTargetWatts: 145,
        calibration: cal,
        meterWatts: 120,
        meterFresh: false,
      }),
    ).toBe(171) // 145 / 0.85
  })

  it('applies offset after scale', () => {
    expect(
      resolveErgSetpoint({
        meterTargetWatts: 100,
        calibration: { scale: 1, offsetWatts: 20 },
        meterWatts: null,
        meterFresh: false,
      }),
    ).toBe(120)
  })

  it('trims toward Assioma error when meter is fresh (within band)', () => {
    // open-loop 145/0.85 ≈ 171; meter 130 vs target 145 → error +15 → trim +maxTrim(10)
    expect(
      resolveErgSetpoint({
        meterTargetWatts: 145,
        calibration: { scale: 0.85, offsetWatts: 0 },
        meterWatts: 130,
        meterFresh: true,
        maxTrimWatts: 10,
        trimGain: 1,
      }),
    ).toBe(181)
  })

  it('does not trim when meter is stale even if a last value exists', () => {
    expect(
      resolveErgSetpoint({
        meterTargetWatts: 145,
        calibration: { scale: 0.85, offsetWatts: 0 },
        meterWatts: 130,
        meterFresh: false,
        maxTrimWatts: 10,
        trimGain: 1,
      }),
    ).toBe(171)
  })

  it('defaults to identity calibration', () => {
    expect(DEFAULT_ERG_CALIBRATION).toEqual({ scale: 1, offsetWatts: 0 })
    expect(
      resolveErgSetpoint({
        meterTargetWatts: 200,
        calibration: DEFAULT_ERG_CALIBRATION,
        meterWatts: 200,
        meterFresh: true,
      }),
    ).toBe(200)
  })
})

describe('adaptErgCalibration', () => {
  it('ignores non-steady samples', () => {
    const cal = { scale: 1, offsetWatts: 0 }
    expect(
      adaptErgCalibration(cal, { meterWatts: 50, trainerWatts: 80 }),
    ).toEqual(cal)
    expect(
      adaptErgCalibration(cal, { meterWatts: 300, trainerWatts: 350 }),
    ).toEqual(cal)
  })

  it('EMA-updates scale toward Meter/Trainer in the steady band', () => {
    const next = adaptErgCalibration(
      { scale: 1, offsetWatts: 0 },
      { meterWatts: 120, trainerWatts: 145 },
      { alpha: 1 },
    )
    expect(next.scale).toBeCloseTo(120 / 145, 5)
    expect(next.offsetWatts).toBe(0)
  })
})
