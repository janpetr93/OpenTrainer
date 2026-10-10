import { livePowerStatus } from '../ftms/livePowerFreshness'
import type { ConnectionState } from '../ftms/types'
import { toKnownDevice, type KnownDevice } from './knownDevice'
import { pickKnownDevice } from './pickKnownDevice'

const FRESHNESS_TICK_MS = 500

export type SensorLinkSnapshot = {
  connectionState: ConnectionState
  deviceName: string | null
  lastSampleAtMs: number | null
  status: ReturnType<typeof livePowerStatus>
  lastError: string | null
  webBluetoothSupported: boolean
  knownDevices: KnownDevice[]
}

type ConnectOptions = {
  acceptAllDevices?: boolean
  forceChooser?: boolean
  deviceId?: string
}

/**
 * Shared Web Bluetooth notify-sensor link (HR, cadence, etc.).
 * Subclasses supply service/characteristic UUIDs, filters, and value handling.
 */
export abstract class NotifySensorConnection<T extends SensorLinkSnapshot> {
  protected snapshot: T
  private listeners = new Set<(snapshot: T) => void>()
  private device: BluetoothDevice | null = null
  private server: BluetoothRemoteGATTServer | null = null
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null
  private freshnessTimer: ReturnType<typeof setInterval> | null = null

  protected abstract readonly serviceUuid: number
  protected abstract readonly characteristicUuid: number
  protected abstract readonly sensorLabel: string
  protected abstract readonly namePrefixes: string[]
  protected abstract readonly knownNamePattern: RegExp
  protected abstract createInitial(): T
  protected abstract valueKey(): keyof T & string
  protected abstract onNotify(view: DataView): Partial<T>

  constructor() {
    this.snapshot = this.createInitial()
  }

  subscribe(listener: (snapshot: T) => void): () => void {
    this.listeners.add(listener)
    listener(this.snapshot)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(): T {
    return this.snapshot
  }

  async refreshKnownDevices(): Promise<BluetoothDevice[]> {
    if (
      !this.snapshot.webBluetoothSupported ||
      !navigator.bluetooth.getDevices
    ) {
      this.patchFields({ knownDevices: [] })
      return []
    }
    try {
      const devices = await navigator.bluetooth.getDevices()
      const matched = devices.filter(
        (d) =>
          d.id === this.device?.id ||
          this.knownNamePattern.test(d.name ?? ''),
      )
      this.patchFields({
        knownDevices: matched.map((d) =>
          toKnownDevice(d, `Known ${this.sensorLabel}`),
        ),
      })
      return matched
    } catch {
      this.patchFields({ knownDevices: [] })
      return []
    }
  }

  async connect(options: ConnectOptions = {}): Promise<void> {
    if (!this.snapshot.webBluetoothSupported) {
      this.patchFields({
        lastError:
          'Web Bluetooth is not available. Use desktop Chrome or Edge over localhost/HTTPS.',
      })
      return
    }

    this.patchFields({
      connectionState: 'connecting',
      lastError: null,
    })

    try {
      if (!options.forceChooser && !options.acceptAllDevices) {
        const known = await this.refreshKnownDevices()
        const preferredRef = pickKnownDevice(
          known.map((d) => toKnownDevice(d, `Known ${this.sensorLabel}`)),
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
          this.patchFields({
            connectionState: this.device
              ? 'disconnected-with-reconnect'
              : 'disconnected',
            lastError: `Known ${this.sensorLabel} not found. Use Find new…`,
          })
          this.stopFreshnessTimer()
          return
        }
      }

      const device = await navigator.bluetooth.requestDevice(
        options.acceptAllDevices
          ? {
              acceptAllDevices: true,
              optionalServices: [this.serviceUuid],
            }
          : {
              filters: [
                { services: [this.serviceUuid] },
                ...this.namePrefixes.map((namePrefix) => ({ namePrefix })),
              ],
              optionalServices: [this.serviceUuid],
            },
      )
      await this.attachAndConnect(device)
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error)
      const message = /cancelled|canceled/i.test(raw)
        ? `${this.sensorLabel} chooser closed. Wake the sensor, then try again.`
        : /no devices|not found|chooser|empty/i.test(raw)
          ? `Chooser empty — wake the ${this.sensorLabel}, quit apps using it, then open chooser or scan all.`
          : raw
      this.patchFields({
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
    this.patchFields({
      connectionState: 'connecting',
      lastError: null,
    })
    try {
      await this.finishConnect(this.device)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.patchFields({
        lastError: `${message} — trying known devices…`,
      })
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
    this.characteristic = null
    this.patchFields({
      connectionState: 'disconnected',
      deviceName: this.device?.name ?? null,
      lastSampleAtMs: null,
      status: 'missing',
      lastError: null,
    })
    this.patch({ [this.valueKey()]: null } as unknown as Partial<T>)
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
    this.characteristic = null
    this.patchFields({
      connectionState: 'disconnected-with-reconnect',
      status:
        this.snapshot.lastSampleAtMs === null ? 'missing' : 'stale',
      lastError: `${this.sensorLabel} disconnected. Reconnect when ready.`,
    })
  }

  private async finishConnect(device: BluetoothDevice): Promise<void> {
    const server = await device.gatt!.connect()
    this.server = server
    const service = await server.getPrimaryService(this.serviceUuid)
    this.characteristic = await service.getCharacteristic(
      this.characteristicUuid,
    )
    await this.characteristic.startNotifications()
    this.characteristic.addEventListener(
      'characteristicvaluechanged',
      this.onCharacteristicValue,
    )
    this.patchFields({
      connectionState: 'connected',
      deviceName: device.name ?? `Unknown ${this.sensorLabel}`,
      lastError: null,
    })
    this.startFreshnessTimer()
  }

  private onCharacteristicValue = (event: Event): void => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic
    const value = characteristic.value
    if (!value) return
    this.patch(this.onNotify(value))
  }

  private startFreshnessTimer(): void {
    this.stopFreshnessTimer()
    this.freshnessTimer = setInterval(() => {
      const value = this.snapshot[this.valueKey()] as number | null
      const status = livePowerStatus({
        lastSampleAtMs: this.snapshot.lastSampleAtMs,
        nowMs: Date.now(),
        watts: value,
      })
      if (status !== this.snapshot.status) {
        this.patchFields({ status })
      }
    }, FRESHNESS_TICK_MS)
  }

  private stopFreshnessTimer(): void {
    if (this.freshnessTimer !== null) {
      clearInterval(this.freshnessTimer)
      this.freshnessTimer = null
    }
  }

  protected patch(partial: Partial<T>): void {
    this.snapshot = { ...this.snapshot, ...partial }
    for (const listener of this.listeners) {
      listener(this.snapshot)
    }
  }

  private patchFields(partial: Partial<SensorLinkSnapshot>): void {
    this.patch(partial as unknown as Partial<T>)
  }
}
