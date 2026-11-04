import type { KnownDevice } from './knownDevice'
import type { RememberedDevice } from './rememberedDevices'

/**
 * What a role's Connect button does:
 * - known: reconnect a device Chrome still permits (no Device Picker)
 * - repair: Device Picker filtered to the remembered device's name
 * - pick: the role's normal Device Picker
 */
export type ConnectAction =
  | { kind: 'known'; label: 'Connect' }
  | { kind: 'repair'; label: string }
  | { kind: 'pick'; label: 'Connect' }

export function connectActionFor(input: {
  knownDevices: KnownDevice[]
  remembered: RememberedDevice | null
}): ConnectAction {
  if (input.knownDevices.length > 0) return { kind: 'known', label: 'Connect' }
  if (input.remembered?.name) {
    return { kind: 'repair', label: `Re-pair ${input.remembered.name}` }
  }
  return { kind: 'pick', label: 'Connect' }
}

/**
 * Device Picker options that list only the remembered device. The role service
 * stays optional rather than a filter: the D100 often leaves FTMS out of its
 * advertisement (docs/decisions/2026-10-09-device-discovery-ftms-uuid.md).
 */
export function rememberedDeviceRequest(
  remembered: RememberedDevice | null,
  serviceUuid: BluetoothServiceUUID,
): RequestDeviceOptions | null {
  if (!remembered?.name) return null
  return {
    filters: [{ name: remembered.name }],
    optionalServices: [serviceUuid],
  }
}

/**
 * Error copy when the name-filtered Device Picker was closed or empty: the
 * remembered device was probably asleep. Null for any other error.
 */
export function repairChooserError(
  raw: string,
  remembered: RememberedDevice | null,
  roleNoun: string,
): string | null {
  if (!remembered?.name) return null
  if (!/cancelled|canceled|no devices|not found|chooser|empty/i.test(raw)) {
    return null
  }
  return `Chooser closed. If ${remembered.name} was not listed, wake it and Re-pair again; for a different ${roleNoun} use Find new… → Chooser.`
}
