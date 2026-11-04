import type { KeyValueStorage } from './rememberedDevices'

/** Chrome flag that makes Web Bluetooth permissions survive a browser restart. */
export const PERSISTENT_PERMISSIONS_FLAG =
  'chrome://flags/#enable-web-bluetooth-new-permissions-backend'

export const PERSISTENCE_HINT_DISMISSED_KEY =
  'openTrainer.bluetoothPersistenceHintDismissed.v1'

/** getDevices() is only exposed when a Web Bluetooth flag is on. */
export function getDevicesAvailable(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.bluetooth?.getDevices === 'function'
  )
}

export type PersistenceHintRole = {
  remembered: boolean
  /** A Known Device from getDevices() is this role's remembered device. */
  knownMatchesRemembered: boolean
}

/**
 * Show the flag hint when the rider has paired before (something is
 * remembered) but Chrome handed none of it back: either getDevices() is
 * missing, or it returned none of the remembered devices.
 */
export function shouldShowPersistenceHint(input: {
  webBluetoothSupported: boolean
  getDevicesAvailable: boolean
  knownDevicesChecked: boolean
  dismissed: boolean
  roles: PersistenceHintRole[]
}): boolean {
  if (!input.webBluetoothSupported || input.dismissed) return false
  const remembered = input.roles.filter((r) => r.remembered)
  if (remembered.length === 0) return false
  if (!input.getDevicesAvailable) return true
  if (!input.knownDevicesChecked) return false
  return remembered.every((r) => !r.knownMatchesRemembered)
}

export function loadPersistenceHintDismissed(
  storage: Pick<KeyValueStorage, 'getItem'> | null,
): boolean {
  if (!storage) return false
  try {
    return storage.getItem(PERSISTENCE_HINT_DISMISSED_KEY) !== null
  } catch {
    return false
  }
}

export function savePersistenceHintDismissed(
  storage: Pick<KeyValueStorage, 'setItem'> | null,
): void {
  try {
    storage?.setItem(PERSISTENCE_HINT_DISMISSED_KEY, new Date().toISOString())
  } catch {
    // Dismissed for this page load only.
  }
}
