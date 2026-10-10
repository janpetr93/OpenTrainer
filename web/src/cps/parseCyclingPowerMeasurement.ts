export type CyclingPowerMeasurement = {
  instantaneousPowerWatts: number
  rawFlags: number
}

/**
 * Parse Cycling Power Measurement (0x2A63) notification payload.
 * Instantaneous Power (sint16) is always present immediately after flags.
 */
export function parseCyclingPowerMeasurement(
  view: DataView,
): CyclingPowerMeasurement {
  const flags = view.getUint16(0, true)
  const instantaneousPowerWatts = view.getInt16(2, true)
  return {
    instantaneousPowerWatts,
    rawFlags: flags,
  }
}
