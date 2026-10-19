import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ERG_CALIBRATION,
  adaptErgCalibration,
  resolveErgSetpoint,
  type ErgAdaptMemory,
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

  it('default trim closes a ~20 W meter shortfall under identity calibration', () => {
    // open-loop 200; meter 180 → error +20 → trim +14 (0.7×20), setpoint 214
    expect(
      resolveErgSetpoint({
        meterTargetWatts: 200,
        calibration: DEFAULT_ERG_CALIBRATION,
        meterWatts: 180,
        meterFresh: true,
      }),
    ).toBe(214)
  })

  it('default trim caps at ±25 W for large Assioma shortfalls', () => {
    // error +60 → 0.7×60 = 42 → clamp to +25
    expect(
      resolveErgSetpoint({
        meterTargetWatts: 200,
        calibration: DEFAULT_ERG_CALIBRATION,
        meterWatts: 140,
        meterFresh: true,
      }),
    ).toBe(225)
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
  it('learns a watt offset so the same gap fits 90 W and 185 W', () => {
    const next = adaptErgCalibration(
      { scale: 0.82, offsetWatts: 0 },
      { meterWatts: 90, trainerWatts: 112 },
      { alpha: 1 },
    )
    expect(next.scale).toBe(1)
    expect(next.offsetWatts).toBe(22)
    expect(
      resolveErgSetpoint({
        meterTargetWatts: 90,
        calibration: next,
        meterWatts: null,
        meterFresh: false,
      }),
    ).toBe(112)
    expect(
      resolveErgSetpoint({
        meterTargetWatts: 185,
        calibration: next,
        meterWatts: null,
        meterFresh: false,
      }),
    ).toBe(207)
  })

  it('learns the gap from interval-power samples above 180 W', () => {
    const next = adaptErgCalibration(
      { scale: 1, offsetWatts: 0 },
      { meterWatts: 203, trainerWatts: 226 },
      { alpha: 1 },
    )
    expect(next.scale).toBe(1)
    expect(next.offsetWatts).toBe(23)
  })

  it('ignores spin-up below 70 W', () => {
    const cal = { scale: 1, offsetWatts: 22 }
    expect(
      adaptErgCalibration(cal, { meterWatts: 50, trainerWatts: 80 }, { alpha: 1 }),
    ).toEqual(cal)
  })

  it('ignores a one-second dip so it cannot rewrite the gap', () => {
    const cal = { scale: 1, offsetWatts: 22 }
    const memory: ErgAdaptMemory = {
      previous: { meterWatts: 203, trainerWatts: 225 },
    }
    const next = adaptErgCalibration(
      cal,
      { meterWatts: 160, trainerWatts: 225 },
      { alpha: 1, memory },
    )
    expect(next).toEqual(cal)
  })

  it('updates the gap from a settled follow-up sample', () => {
    const memory: ErgAdaptMemory = {
      previous: { meterWatts: 200, trainerWatts: 222 },
    }
    const next = adaptErgCalibration(
      { scale: 1, offsetWatts: 20 },
      { meterWatts: 203, trainerWatts: 226 },
      { alpha: 1, memory },
    )
    expect(next.offsetWatts).toBe(23)
    expect(memory.previous).toEqual({ meterWatts: 203, trainerWatts: 226 })
  })
})
