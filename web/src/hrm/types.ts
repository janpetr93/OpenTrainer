import type { KnownDevice } from '../ble/knownDevice'
import type { LivePowerStatus } from '../ftms/livePowerFreshness'
import type { ConnectionState } from '../ftms/types'

export type HeartRateSnapshot = {
  connectionState: ConnectionState
  deviceName: string | null
  bpm: number | null
  lastSampleAtMs: number | null
  status: LivePowerStatus
  lastError: string | null
  webBluetoothSupported: boolean
  knownDevices: KnownDevice[]
}

export const initialHeartRateSnapshot = (): HeartRateSnapshot => ({
  connectionState: 'disconnected',
  deviceName: null,
  bpm: null,
  lastSampleAtMs: null,
  status: 'missing',
  lastError: null,
  webBluetoothSupported:
    typeof navigator !== 'undefined' && 'bluetooth' in navigator,
  knownDevices: [],
})
