import { describe, expect, it } from 'vitest'
import { parseFitnessMachineFeatures } from './parseFitnessMachineFeatures'

describe('parseFitnessMachineFeatures', () => {
  it('detects target-power support from the target-setting feature bits', () => {
    // Fitness Machine Features (4 bytes) + Target Setting Features (4 bytes)
    // Target power bit in target setting features = bit 3 (Set Target Power)
    const buffer = new ArrayBuffer(8)
    const view = new DataView(buffer)
    view.setUint32(0, 0, true)
    view.setUint32(4, 1 << 3, true)

    const features = parseFitnessMachineFeatures(view)
    expect(features.targetPowerSupported).toBe(true)
  })

  it('reports target power unsupported when the bit is clear', () => {
    const buffer = new ArrayBuffer(8)
    const view = new DataView(buffer)
    view.setUint32(0, 0, true)
    view.setUint32(4, 0, true)

    const features = parseFitnessMachineFeatures(view)
    expect(features.targetPowerSupported).toBe(false)
  })
})
