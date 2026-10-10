import { describe, expect, it } from 'vitest'
import { parseHeartRateMeasurement } from './parseHeartRateMeasurement'

describe('parseHeartRateMeasurement', () => {
  it('reads uint8 heart rate when the 16-bit flag is clear', () => {
    const buffer = new ArrayBuffer(2)
    const view = new DataView(buffer)
    view.setUint8(0, 0)
    view.setUint8(1, 142)
    expect(parseHeartRateMeasurement(view).bpm).toBe(142)
  })

  it('reads uint16 heart rate when the 16-bit flag is set', () => {
    const buffer = new ArrayBuffer(3)
    const view = new DataView(buffer)
    view.setUint8(0, 1 << 0)
    view.setUint16(1, 180, true)
    expect(parseHeartRateMeasurement(view).bpm).toBe(180)
  })
})
