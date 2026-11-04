/**
 * Remembered Devices: the last device the rider connected per role, kept in
 * this browser's localStorage so the app can name it after a restart even when
 * Chrome has forgotten the Bluetooth permission (see
 * docs/decisions/2026-11-04-remember-paired-devices.md).
 *
 * This is the renderer-side contract a desktop shell can read to auto-pick a
 * device: key REMEMBERED_DEVICES_STORAGE_KEY, value
 * `{ version: 1, devices: { [role]: { id, name, rememberedAt } } }`.
 * `id` is the origin-scoped Web Bluetooth `BluetoothDevice.id`; `name` is the
 * advertised name, the stable key across origins and restarts.
 */

export type DeviceRole = 'trainer' | 'powerMeter' | 'heartRate' | 'cadence'

export const DEVICE_ROLES: readonly DeviceRole[] = [
  'trainer',
  'powerMeter',
  'heartRate',
  'cadence',
]

export type RememberedDevice = {
  id: string
  /** Advertised name, or null when the device had none. */
  name: string | null
  rememberedAt: string
}

export type RememberedDevices = Partial<Record<DeviceRole, RememberedDevice>>

export const REMEMBERED_DEVICES_STORAGE_KEY = 'openTrainer.rememberedDevices.v1'

const VERSION = 1

export type KeyValueStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function isRole(value: string): value is DeviceRole {
  return (DEVICE_ROLES as readonly string[]).includes(value)
}

function cleanName(name: string | null | undefined): string | null {
  const trimmed = name?.trim()
  return trimmed ? trimmed : null
}

function parseEntry(value: unknown): RememberedDevice | null {
  if (typeof value !== 'object' || value === null) return null
  const entry = value as Record<string, unknown>
  if (typeof entry.id !== 'string' || entry.id === '') return null
  if (typeof entry.rememberedAt !== 'string') return null
  if (entry.name !== null && typeof entry.name !== 'string') return null
  return {
    id: entry.id,
    name: cleanName(entry.name as string | null),
    rememberedAt: entry.rememberedAt,
  }
}

export function parseRememberedDevices(raw: string | null): RememberedDevices {
  if (raw === null) return {}
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return {}
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {}
  }
  const record = data as Record<string, unknown>
  if (record.version !== VERSION) return {}
  if (typeof record.devices !== 'object' || record.devices === null) return {}

  const result: RememberedDevices = {}
  for (const [role, value] of Object.entries(record.devices)) {
    if (!isRole(role)) continue
    const entry = parseEntry(value)
    if (entry) result[role] = entry
  }
  return result
}

export function serializeRememberedDevices(devices: RememberedDevices): string {
  return JSON.stringify({ version: VERSION, devices })
}

export function rememberDevice(
  devices: RememberedDevices,
  role: DeviceRole,
  device: { id: string; name?: string | null },
  now: Date,
): RememberedDevices {
  return {
    ...devices,
    [role]: {
      id: device.id,
      name: cleanName(device.name),
      rememberedAt: now.toISOString(),
    },
  }
}

export function forgetDevice(
  devices: RememberedDevices,
  role: DeviceRole,
): RememberedDevices {
  const next = { ...devices }
  delete next[role]
  return next
}

/**
 * Reads once at construction and writes through on every change. Storage
 * failures (private mode, blocked site data) fall back to memory only.
 */
export class RememberedDeviceStore {
  private devices: RememberedDevices
  private readonly storage: KeyValueStorage | null
  private readonly now: () => Date

  constructor(
    storage: KeyValueStorage | null,
    now: () => Date = () => new Date(),
  ) {
    this.storage = storage
    this.now = now
    let raw: string | null = null
    try {
      raw = storage?.getItem(REMEMBERED_DEVICES_STORAGE_KEY) ?? null
    } catch {
      raw = null
    }
    this.devices = parseRememberedDevices(raw)
  }

  get(role: DeviceRole): RememberedDevice | null {
    return this.devices[role] ?? null
  }

  getAll(): RememberedDevices {
    return { ...this.devices }
  }

  remember(
    role: DeviceRole,
    device: { id: string; name?: string | null },
  ): RememberedDevice {
    this.devices = rememberDevice(this.devices, role, device, this.now())
    this.save()
    return this.devices[role]!
  }

  forget(role: DeviceRole): void {
    this.devices = forgetDevice(this.devices, role)
    this.save()
  }

  private save(): void {
    try {
      this.storage?.setItem(
        REMEMBERED_DEVICES_STORAGE_KEY,
        serializeRememberedDevices(this.devices),
      )
    } catch {
      // Keep the in-memory copy; the next page load will not see it.
    }
  }
}

/** window.localStorage, or null where it is missing or blocked. */
export function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null
  } catch {
    return null
  }
}

let sharedStore: RememberedDeviceStore | null = null

/** The page-wide store backed by localStorage (memory-only outside a browser). */
export function rememberedDeviceStore(): RememberedDeviceStore {
  sharedStore ??= new RememberedDeviceStore(browserStorage())
  return sharedStore
}
