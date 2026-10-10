export type FitnessMachineFeatures = {
  fitnessMachineFeatures: number
  targetSettingFeatures: number
  targetPowerSupported: boolean
  rawHex: string
}

/** Target Setting Features bit 3: Set Target Power supported */
const TARGET_POWER_BIT = 1 << 3

/**
 * Parse FTMS Fitness Machine Feature characteristic (0x2ACC):
 * 4 bytes machine features + 4 bytes target setting features.
 */
export function parseFitnessMachineFeatures(view: DataView): FitnessMachineFeatures {
  const fitnessMachineFeatures = view.getUint32(0, true)
  const targetSettingFeatures = view.byteLength >= 8 ? view.getUint32(4, true) : 0
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  const rawHex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' ')

  return {
    fitnessMachineFeatures,
    targetSettingFeatures,
    targetPowerSupported: (targetSettingFeatures & TARGET_POWER_BIT) !== 0,
    rawHex,
  }
}
