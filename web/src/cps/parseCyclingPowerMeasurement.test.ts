import { describe, expect, it } from 'vitest'
import { parseCyclingPowerMeasurement } from './parseCyclingPowerMeasurement'

/** Minimal CPM: flags + instantaneous power only. */
function bytesWithInstantPower(watts: number, flags = 0): DataView {
  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)
  view.setUint16(0, flags, true)
  view.setInt16(2, watts, true)
  return view
}

describe('parseCyclingPowerMeasurement', () => {
  it('extracts Meter Power from Instantaneous Power (always present)', () => {
    const parsed = parseCyclingPowerMeasurement(bytesWithInstantPower(210))
    expect(parsed.instantaneousPowerWatts).toBe(210)
  })

  it('still reads Instantaneous Power when Pedal Power Balance flag is set', () => {
    // bit 0 = Pedal Power Balance Present (uint8 after power — ignored for now)
    const buffer = new ArrayBuffer(5)
    const view = new DataView(buffer)
    view.setUint16(0, 1 << 0, true)
    view.setInt16(2, 180, true)
    view.setUint8(4, 50)
    const parsed = parseCyclingPowerMeasurement(view)
    expect(parsed.instantaneousPowerWatts).toBe(180)
    expect(parsed.rawFlags).toBe(1)
  })
})
