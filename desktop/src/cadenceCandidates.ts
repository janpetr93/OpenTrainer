/**
 * Which nearby peripherals the desktop cadence picker offers.
 *
 * Web Bluetooth only lists a device that advertises CSC (0x1816) or whose name
 * starts with a known brand. The Van Rysel cadence sensor often does neither.
 * CoreBluetooth still sees the packet, so the picker keeps nearby non-Apple
 * peripherals, plus anything that advertises the cadence service.
 */

export type ScannedPeripheral = {
  id: string
  name: string
  rssi: number
  connectable: boolean
  /** Advertised service UUIDs, short (1816) or 128-bit. */
  services: string[]
  /** Bluetooth company id from manufacturer data, or null when absent. */
  companyId: number | null
}

/** Apple, Inc. Devices with this id are phones, watches, and audio — not the sensor. */
const APPLE_COMPANY_ID = 0x004c

/** Unnamed peripherals weaker than this are other rooms' noise. */
const UNNAMED_RSSI_FLOOR = -80

/** The D100 trainer. It has no CSC service; listing it here only causes a failed connect. */
const TRAINER_NAME = /^VANRYSEL-HT/i

const SENSOR_NAME =
  /cadence|csc|speed.?cad|magene|wahoo|bryton|coospo|xoss|igpsport|cycplus|moofit|^bk\d|garmin|vanrysel|van rysel/i

const CSC_128 = '0000181600001000800000805F9B34FB'

export function advertisesCadence(services: readonly string[]): boolean {
  return services.some((service) => {
    const compact = service.replace(/-/g, '').toUpperCase()
    return compact === '1816' || compact === CSC_128
  })
}

function isCandidate(device: ScannedPeripheral): boolean {
  if (!device.connectable || device.id.trim() === '') return false
  const name = device.name.trim()
  if (TRAINER_NAME.test(name)) return false
  if (advertisesCadence(device.services)) return true
  if (device.companyId === APPLE_COMPANY_ID) return false
  if (SENSOR_NAME.test(name)) return true
  // A named peripheral that is not a known brand can still be this sensor.
  // MyWhoosh lists it; the Web Bluetooth prefixes do not.
  return device.rssi >= UNNAMED_RSSI_FLOOR
}

function label(device: ScannedPeripheral): string {
  const name = device.name.trim()
  if (name) return name
  if (advertisesCadence(device.services)) return 'Cadence sensor'
  return ''
}

/** Merge repeated advertisements, then keep the peripherals the rider can pick. */
export function cadenceCandidates(
  devices: readonly ScannedPeripheral[],
): { id: string; name: string }[] {
  const byId = new Map<string, ScannedPeripheral>()
  for (const device of devices) {
    const previous = byId.get(device.id)
    if (!previous) {
      byId.set(device.id, device)
      continue
    }
    byId.set(device.id, {
      ...device,
      name: device.name.trim() ? device.name : previous.name,
      rssi: Math.max(device.rssi, previous.rssi),
      connectable: device.connectable || previous.connectable,
      services: [...new Set([...previous.services, ...device.services])],
      companyId: device.companyId ?? previous.companyId,
    })
  }

  return [...byId.values()]
    .filter(isCandidate)
    .sort((a, b) => {
      const serviceOrder =
        Number(advertisesCadence(b.services)) - Number(advertisesCadence(a.services))
      if (serviceOrder !== 0) return serviceOrder
      return b.rssi - a.rssi || a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
    })
    .map((device) => ({ id: device.id, name: label(device) }))
}
