export type HeartRateMeasurement = {
  bpm: number
  rawFlags: number
}

const FLAG_HR_UINT16 = 1 << 0

/**
 * Parse Heart Rate Measurement (0x2A37) notification payload.
 */
export function parseHeartRateMeasurement(view: DataView): HeartRateMeasurement {
  const flags = view.getUint8(0)
  const bpm =
    flags & FLAG_HR_UINT16
      ? view.getUint16(1, true)
      : view.getUint8(1)
  return { bpm, rawFlags: flags }
}
