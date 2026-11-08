import type { KnownDevice } from '../ble/knownDevice'
import type { RememberedDevice } from '../ble/rememberedDevices'
import type { LivePowerStatus } from '../ftms/livePowerFreshness'
import type { ConnectionState } from '../ftms/types'

export type CadenceSnapshot = {
  connectionState: ConnectionState
  deviceName: string | null
  rpm: number | null
  lastSampleAtMs: number | null
  status: LivePowerStatus
  lastError: string | null
  webBluetoothSupported: boolean
  knownDevices: KnownDevice[]
  knownDevicesChecked: boolean
  rememberedDevice: RememberedDevice | null
}

/** Shown while the link is up and no crank reading has arrived yet. */
export const CADENCE_WAITING_HINT =
  'Spin the crank. This sensor stays quiet until the magnet passes. A green light is speed only — red is cadence.'

export const initialCadenceSnapshot = (): CadenceSnapshot => ({
  connectionState: 'disconnected',
  deviceName: null,
  rpm: null,
  lastSampleAtMs: null,
  status: 'missing',
  lastError: null,
  webBluetoothSupported:
    typeof navigator !== 'undefined' && 'bluetooth' in navigator,
  knownDevices: [],
  knownDevicesChecked: false,
  rememberedDevice: null,
})
