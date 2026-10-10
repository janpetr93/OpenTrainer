import type { KnownDevice } from '../ble/knownDevice'
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
}

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
})
