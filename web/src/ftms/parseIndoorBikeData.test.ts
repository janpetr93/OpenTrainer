import { describe, expect, it } from 'vitest'
import { parseIndoorBikeData } from './parseIndoorBikeData'

/** Build Indoor Bike Data with instantaneous power only (More Data set ⇒ no speed field). */
function bytesWithInstantPower(watts: number): DataView {
  const flags = (1 << 0) | (1 << 6) // More Data + Instantaneous Power
  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)
  view.setUint16(0, flags, true)
  view.setInt16(2, watts, true)
  return view
}

describe('parseIndoorBikeData', () => {
  it('extracts instantaneous Live Power when the power flag is set', () => {
    const parsed = parseIndoorBikeData(bytesWithInstantPower(185))
    expect(parsed.instantaneousPowerWatts).toBe(185)
  })

  it('reports null Live Power when the power flag is absent', () => {
    const flags = 1 << 0 // More Data only — no power field
    const buffer = new ArrayBuffer(2)
    const view = new DataView(buffer)
    view.setUint16(0, flags, true)
    const parsed = parseIndoorBikeData(view)
    expect(parsed.instantaneousPowerWatts).toBeNull()
  })
})
