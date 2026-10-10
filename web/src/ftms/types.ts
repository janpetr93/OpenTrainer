import type { KnownDevice } from '../ble/knownDevice'
import type { FitnessMachineFeatures } from './parseFitnessMachineFeatures'
import type { LivePowerStatus } from './livePowerFreshness'

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'disconnected-with-reconnect'

export type TrainerSnapshot = {
  connectionState: ConnectionState
  deviceName: string | null
  watts: number | null
  lastPowerAtMs: number | null
  powerStatus: LivePowerStatus
  cadenceRpm: number | null
  speedKmh: number | null
  features: FitnessMachineFeatures | null
  services: string[]
  characteristics: string[]
  controlProbeLog: string[]
  lastIndoorBikeRaw: Record<string, number> | null
  lastError: string | null
  webBluetoothSupported: boolean
  /** True after Control Probe accepted Set Target Power. */
  ergControlAvailable: boolean
  /** Previously permitted devices from navigator.bluetooth.getDevices(). */
  knownDevices: KnownDevice[]
}

export const initialSnapshot = (): TrainerSnapshot => ({
  connectionState: 'disconnected',
  deviceName: null,
  watts: null,
  lastPowerAtMs: null,
  powerStatus: 'missing',
  cadenceRpm: null,
  speedKmh: null,
  features: null,
  services: [],
  characteristics: [],
  controlProbeLog: [],
  lastIndoorBikeRaw: null,
  lastError: null,
  webBluetoothSupported: typeof navigator !== 'undefined' && 'bluetooth' in navigator,
  ergControlAvailable: false,
  knownDevices: [],
})
