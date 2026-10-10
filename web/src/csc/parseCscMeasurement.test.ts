import { describe, expect, it } from 'vitest'
import { parseCscMeasurement } from './parseCscMeasurement'

describe('parseCscMeasurement', () => {
  it('extracts crank revolution data when the crank flag is set', () => {
    const buffer = new ArrayBuffer(5)
    const view = new DataView(buffer)
    view.setUint8(0, 1 << 1) // crank present
    view.setUint16(1, 100, true)
    view.setUint16(3, 2048, true)
    const parsed = parseCscMeasurement(view)
    expect(parsed.cumulativeCrankRevs).toBe(100)
    expect(parsed.lastCrankEventTime).toBe(2048)
  })

  it('skips wheel data before crank fields', () => {
    const buffer = new ArrayBuffer(11)
    const view = new DataView(buffer)
    view.setUint8(0, (1 << 0) | (1 << 1))
    view.setUint32(1, 50, true)
    view.setUint16(5, 10, true)
    view.setUint16(7, 200, true)
    view.setUint16(9, 512, true)
    const parsed = parseCscMeasurement(view)
    expect(parsed.cumulativeCrankRevs).toBe(200)
    expect(parsed.lastCrankEventTime).toBe(512)
  })
})
