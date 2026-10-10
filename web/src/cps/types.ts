import type { KnownDevice } from '../ble/knownDevice'
import type { ConnectionState } from '../ftms/types'
import type { LivePowerStatus } from '../ftms/livePowerFreshness'

export type PowerMeterSnapshot = {
  connectionState: ConnectionState
  deviceName: string | null
  watts: number | null
  lastPowerAtMs: number | null
  powerStatus: LivePowerStatus
  lastError: string | null
  webBluetoothSupported: boolean
  knownDevices: KnownDevice[]
}

export const initialPowerMeterSnapshot = (): PowerMeterSnapshot => ({
  connectionState: 'disconnected',
  deviceName: null,
  watts: null,
  lastPowerAtMs: null,
  powerStatus: 'missing',
  lastError: null,
  webBluetoothSupported:
    typeof navigator !== 'undefined' && 'bluetooth' in navigator,
  knownDevices: [],
})
