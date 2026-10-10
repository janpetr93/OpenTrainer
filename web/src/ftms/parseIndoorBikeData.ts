export type IndoorBikeData = {
  instantaneousPowerWatts: number | null
  instantaneousCadenceRpm: number | null
  instantaneousSpeedKmh: number | null
  rawFields: Record<string, number>
}

const FLAG_MORE_DATA = 1 << 0
const FLAG_AVERAGE_SPEED = 1 << 1
const FLAG_INSTANTANEOUS_CADENCE = 1 << 2
const FLAG_AVERAGE_CADENCE = 1 << 3
const FLAG_TOTAL_DISTANCE = 1 << 4
const FLAG_RESISTANCE_LEVEL = 1 << 5
const FLAG_INSTANTANEOUS_POWER = 1 << 6
const FLAG_AVERAGE_POWER = 1 << 7
const FLAG_EXPENDED_ENERGY = 1 << 8
const FLAG_HEART_RATE = 1 << 9
const FLAG_METABOLIC_EQUIVALENT = 1 << 10
const FLAG_ELAPSED_TIME = 1 << 11
const FLAG_REMAINING_TIME = 1 << 12

/**
 * Parse FTMS Indoor Bike Data (0x2AD2) notification payload.
 * Instantaneous speed is present when More Data (bit 0) is NOT set.
 */
export function parseIndoorBikeData(view: DataView): IndoorBikeData {
  let offset = 0
  const flags = view.getUint16(offset, true)
  offset += 2

  const rawFields: Record<string, number> = { flags }
  let instantaneousSpeedKmh: number | null = null
  let instantaneousCadenceRpm: number | null = null
  let instantaneousPowerWatts: number | null = null

  if ((flags & FLAG_MORE_DATA) === 0) {
    // uint16, 1/100 km/h
    const raw = view.getUint16(offset, true)
    offset += 2
    instantaneousSpeedKmh = raw / 100
    rawFields.instantaneousSpeed = raw
  }

  if (flags & FLAG_AVERAGE_SPEED) {
    rawFields.averageSpeed = view.getUint16(offset, true)
    offset += 2
  }

  if (flags & FLAG_INSTANTANEOUS_CADENCE) {
    // uint16, 1/2 rpm
    const raw = view.getUint16(offset, true)
    offset += 2
    instantaneousCadenceRpm = raw / 2
    rawFields.instantaneousCadence = raw
  }

  if (flags & FLAG_AVERAGE_CADENCE) {
    rawFields.averageCadence = view.getUint16(offset, true)
    offset += 2
  }

  if (flags & FLAG_TOTAL_DISTANCE) {
    rawFields.totalDistance =
      view.getUint8(offset) |
      (view.getUint8(offset + 1) << 8) |
      (view.getUint8(offset + 2) << 16)
    offset += 3
  }

  if (flags & FLAG_RESISTANCE_LEVEL) {
    rawFields.resistanceLevel = view.getInt16(offset, true)
    offset += 2
  }

  if (flags & FLAG_INSTANTANEOUS_POWER) {
    instantaneousPowerWatts = view.getInt16(offset, true)
    offset += 2
    rawFields.instantaneousPower = instantaneousPowerWatts
  }

  if (flags & FLAG_AVERAGE_POWER) {
    rawFields.averagePower = view.getInt16(offset, true)
    offset += 2
  }

  if (flags & FLAG_EXPENDED_ENERGY) {
    rawFields.totalEnergy = view.getUint16(offset, true)
    offset += 2
    rawFields.energyPerHour = view.getUint16(offset, true)
    offset += 2
    rawFields.energyPerMinute = view.getUint8(offset)
    offset += 1
  }

  if (flags & FLAG_HEART_RATE) {
    rawFields.heartRate = view.getUint8(offset)
    offset += 1
  }

  if (flags & FLAG_METABOLIC_EQUIVALENT) {
    rawFields.metabolicEquivalent = view.getUint8(offset)
    offset += 1
  }

  if (flags & FLAG_ELAPSED_TIME) {
    rawFields.elapsedTime = view.getUint16(offset, true)
    offset += 2
  }

  if (flags & FLAG_REMAINING_TIME) {
    rawFields.remainingTime = view.getUint16(offset, true)
  }

  return {
    instantaneousPowerWatts,
    instantaneousCadenceRpm,
    instantaneousSpeedKmh,
    rawFields,
  }
}
