import { toKnownDevice } from '../ble/knownDevice'
import { pickKnownDevice } from '../ble/pickKnownDevice'
import { livePowerStatus } from '../ftms/livePowerFreshness'
import { parseCyclingPowerMeasurement } from './parseCyclingPowerMeasurement'
import {
  initialPowerMeterSnapshot,
  type PowerMeterSnapshot,
} from './types'
import { CYCLING_POWER_MEASUREMENT, CYCLING_POWER_SERVICE } from './uuids'

const FRESHNESS_TICK_MS = 500

const ASSIOMA_NAME = /assioma|favero|uno|asi/i

type Listener = (snapshot: PowerMeterSnapshot) => void

export class PowerMeterConnection {
  private snapshot: PowerMeterSnapshot = initialPowerMeterSnapshot()
  private listeners = new Set<Listener>()
  private device: BluetoothDevice | null = null
  private server: BluetoothRemoteGATTServer | null = null
  private measurementChar: BluetoothRemoteGATTCharacteristic | null = null
  private freshnessTimer: ReturnType<typeof setInterval> | null = null

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(): PowerMeterSnapshot {
    return this.snapshot
  }

  async refreshKnownDevices(): Promise<BluetoothDevice[]> {
    if (
      !this.snapshot.webBluetoothSupported ||
      !navigator.bluetooth.getDevices
    ) {
      this.patch({ knownDevices: [] })
      return []
    }
    try {
      const devices = await navigator.bluetooth.getDevices()
      const meters = devices.filter(
        (d) => d.id === this.device?.id || ASSIOMA_NAME.test(d.name ?? ''),
      )
      this.patch({
        knownDevices: meters.map((d) =>
          toKnownDevice(d, 'Known power meter'),
        ),
      })
      return meters
    } catch {
      this.patch({ knownDevices: [] })
      return []
    }
  }

  async connect(
    options: {
      acceptAllDevices?: boolean
      forceChooser?: boolean
      deviceId?: string
    } = {},
  ): Promise<void> {
    if (!this.snapshot.webBluetoothSupported) {
      this.patch({
        lastError:
          'Web Bluetooth is not available. Use desktop Chrome or Edge over localhost/HTTPS.',
      })
      return
    }

    this.patch({
      connectionState: 'connecting',
      lastError: null,
    })

    try {
      if (!options.forceChooser && !options.acceptAllDevices) {
        const known = await this.refreshKnownDevices()
        const preferredRef = pickKnownDevice(
          known.map((d) => toKnownDevice(d, 'Known power meter')),
          {
            deviceId: options.deviceId,
            lastUsedDeviceId: this.device?.id ?? null,
          },
        )
        const preferred = preferredRef
          ? known.find((d) => d.id === preferredRef.id)
          : undefined
        if (preferred) {
          await this.attachAndConnect(preferred)
          return
        }
        if (options.deviceId) {
          this.patch({
            connectionState: this.device
              ? 'disconnected-with-reconnect'
              : 'disconnected',
            lastError: 'Known power meter not found. Use Find new…',
          })
          this.stopFreshnessTimer()
          return
        }
      }

      const device = await navigator.bluetooth.requestDevice(
        options.acceptAllDevices
          ? {
              acceptAllDevices: true,
              optionalServices: [CYCLING_POWER_SERVICE],
            }
          : {
              filters: [
                { services: [CYCLING_POWER_SERVICE] },
                { namePrefix: 'Assioma' },
                { namePrefix: 'Favero' },
                { namePrefix: 'ASI' },
              ],
              optionalServices: [CYCLING_POWER_SERVICE],
            },
      )
      await this.attachAndConnect(device)
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error)
      const message = /cancelled|canceled/i.test(raw)
        ? 'Power meter chooser closed. Wake the Assioma Uno (spin the pedal), then try again.'
        : /no devices|not found|chooser|empty/i.test(raw)
          ? 'Chooser empty — wake the Assioma (spin/crank), quit other apps using it, then Open chooser or Scan all.'
          : raw
      this.patch({
        connectionState: this.device
          ? 'disconnected-with-reconnect'
          : 'disconnected',
        lastError: message,
      })
      this.stopFreshnessTimer()
    }
  }

  async reconnect(): Promise<void> {
    if (!this.device) {
      await this.connect()
      return
    }
    this.patch({ connectionState: 'connecting', lastError: null })
    try {
      await this.finishConnect(this.device)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.patch({ lastError: `${message} — trying known devices…` })
      await this.connect()
    }
  }

  async disconnect(): Promise<void> {
    this.stopFreshnessTimer()
    if (this.device) {
      this.device.removeEventListener(
        'gattserverdisconnected',
        this.onDisconnected,
      )
    }
    try {
      if (this.server?.connected) {
        this.server.disconnect()
      } else if (this.device?.gatt?.connected) {
        this.device.gatt.disconnect()
      }
    } catch {
      // ignore
    }
    this.server = null
    this.measurementChar = null
    this.patch({
      connectionState: 'disconnected',
      deviceName: this.device?.name ?? null,
      watts: null,
      lastPowerAtMs: null,
      powerStatus: 'missing',
    })
    await this.refreshKnownDevices()
  }

  private async attachAndConnect(device: BluetoothDevice): Promise<void> {
    this.device = device
    device.removeEventListener('gattserverdisconnected', this.onDisconnected)
    device.addEventListener('gattserverdisconnected', this.onDisconnected)
    await this.finishConnect(device)
  }

  private onDisconnected = (): void => {
    this.stopFreshnessTimer()
    this.server = null
    this.measurementChar = null
    this.patch({
      connectionState: 'disconnected-with-reconnect',
      powerStatus:
        this.snapshot.lastPowerAtMs === null ? 'missing' : 'stale',
      lastError: 'Power meter disconnected. Reconnect when ready.',
    })
  }

  private async finishConnect(device: BluetoothDevice): Promise<void> {
    const server = await device.gatt!.connect()
    this.server = server

    const cps = await server.getPrimaryService(CYCLING_POWER_SERVICE)
    this.measurementChar = await cps.getCharacteristic(
      CYCLING_POWER_MEASUREMENT,
    )
    await this.measurementChar.startNotifications()
    this.measurementChar.addEventListener(
      'characteristicvaluechanged',
      this.onMeasurement,
    )

    this.patch({
      connectionState: 'connected',
      deviceName: device.name ?? 'Unknown power meter',
      lastError: null,
    })
    this.startFreshnessTimer()
  }

  private onMeasurement = (event: Event): void => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic
    const value = characteristic.value
    if (!value) return

    const parsed = parseCyclingPowerMeasurement(value)
    const nowMs = Date.now()
    this.patch({
      watts: parsed.instantaneousPowerWatts,
      lastPowerAtMs: nowMs,
      powerStatus: 'fresh',
    })
  }

  private startFreshnessTimer(): void {
    this.stopFreshnessTimer()
    this.freshnessTimer = setInterval(() => {
      const powerStatus = livePowerStatus({
        lastSampleAtMs: this.snapshot.lastPowerAtMs,
        nowMs: Date.now(),
        watts: this.snapshot.watts,
      })
      if (powerStatus !== this.snapshot.powerStatus) {
        this.patch({ powerStatus })
      }
    }, FRESHNESS_TICK_MS)
  }

  private stopFreshnessTimer(): void {
    if (this.freshnessTimer !== null) {
      clearInterval(this.freshnessTimer)
      this.freshnessTimer = null
    }
  }

  private patch(partial: Partial<PowerMeterSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial }
    for (const listener of this.listeners) {
      listener(this.snapshot)
    }
  }
}
