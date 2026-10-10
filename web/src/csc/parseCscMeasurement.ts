export type CscMeasurement = {
  cumulativeCrankRevs: number | null
  lastCrankEventTime: number | null
  rawFlags: number
}

const FLAG_WHEEL_REVOLUTION_DATA = 1 << 0
const FLAG_CRANK_REVOLUTION_DATA = 1 << 1

/**
 * Parse CSC Measurement (0x2A5B). Cadence uses optional crank revolution data.
 */
export function parseCscMeasurement(view: DataView): CscMeasurement {
  let offset = 0
  const flags = view.getUint8(offset)
  offset += 1

  if (flags & FLAG_WHEEL_REVOLUTION_DATA) {
    offset += 6 // uint32 wheel revs + uint16 last wheel event time
  }

  let cumulativeCrankRevs: number | null = null
  let lastCrankEventTime: number | null = null

  if (flags & FLAG_CRANK_REVOLUTION_DATA) {
    cumulativeCrankRevs = view.getUint16(offset, true)
    offset += 2
    lastCrankEventTime = view.getUint16(offset, true)
  }

  return {
    cumulativeCrankRevs,
    lastCrankEventTime,
    rawFlags: flags,
  }
}
