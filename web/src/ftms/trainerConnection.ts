import { toKnownDevice } from '../ble/knownDevice'
import { pickKnownDevice } from '../ble/pickKnownDevice'
import {
  buildRequestControlCommand,
  buildSetTargetPowerCommand,
  interpretControlPointResponse,
} from './controlProbe'
import { livePowerStatus } from './livePowerFreshness'
import { parseFitnessMachineFeatures } from './parseFitnessMachineFeatures'
import { parseIndoorBikeData } from './parseIndoorBikeData'
import { initialSnapshot, type TrainerSnapshot } from './types'
import {
  FITNESS_MACHINE_CONTROL_POINT,
  FITNESS_MACHINE_FEATURE,
  FTMS_SERVICE,
  INDOOR_BIKE_DATA,
} from './uuids'

const TRAINER_NAME = /d100|van\s*rysel|decathlon|ftms|bike|trainer/i

const CONTROL_RESPONSE_TIMEOUT_MS = 5000
const FRESHNESS_TICK_MS = 500
const DEFAULT_PROBE_WATTS = 100

type Listener = (snapshot: TrainerSnapshot) => void

function uuidLabel(uuid: string): string {
  return uuid
}

export class TrainerConnection {
  private snapshot: TrainerSnapshot = initialSnapshot()
  private listeners = new Set<Listener>()
  private device: BluetoothDevice | null = null
  private server: BluetoothRemoteGATTServer | null = null
  private indoorBikeChar: BluetoothRemoteGATTCharacteristic | null = null
  private controlPointChar: BluetoothRemoteGATTCharacteristic | null = null
  private freshnessTimer: ReturnType<typeof setInterval> | null = null
  private controlResponseWaiter: {
    resolve: (view: DataView) => void
    reject: (error: Error) => void
  } | null = null

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.snapshot)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot(): TrainerSnapshot {
    return this.snapshot
  }

  /** Refresh list of devices this origin already may reconnect to (no scan). */
  async refreshKnownDevices(): Promise<BluetoothDevice[]> {
    if (!this.snapshot.webBluetoothSupported || !navigator.bluetooth.getDevices) {
      this.patch({ knownDevices: [] })
      return []
    }
    try {
      const devices = await navigator.bluetooth.getDevices()
      const matched = devices.filter(
        (d) => d.id === this.device?.id || TRAINER_NAME.test(d.name ?? ''),
      )
      this.patch({
        knownDevices: matched.map((d) => toKnownDevice(d, 'Known trainer')),
      })
      return matched
    } catch {
      this.patch({ knownDevices: [] })
      return []
    }
  }

  /**
   * Connect. Prefers a previously permitted device (no chooser / no advertising
   * required). Use forceChooser / acceptAllDevices to open the browser picker.
   */
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
      controlProbeLog: [],
      ergControlAvailable: false,
    })

    try {
      // After the first successful connect, the D100 often stops advertising while
      // still permitted in Chrome — getDevices() reconnects without a scan.
      if (!options.forceChooser && !options.acceptAllDevices) {
        const known = await this.refreshKnownDevices()
        const preferredRef = pickKnownDevice(
          known.map((d) => toKnownDevice(d, 'Known trainer')),
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
            lastError: 'Known trainer not found. Use Find new…',
          })
          return
        }
      }

      // FTMS is often missing from advertisements — OR name prefixes; FTMS via optionalServices.
      const device = await navigator.bluetooth.requestDevice(
        options.acceptAllDevices
          ? {
              acceptAllDevices: true,
              optionalServices: [FTMS_SERVICE],
            }
          : {
              filters: [
                { services: [FTMS_SERVICE] },
                { namePrefix: 'D100' },
                { namePrefix: 'Van' },
                { namePrefix: 'VAN' },
                { namePrefix: 'Decathlon' },
                { namePrefix: 'FTMS' },
                { namePrefix: 'Bike' },
              ],
              optionalServices: [FTMS_SERVICE],
            },
      )
      await this.attachAndConnect(device)
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error)
      const message = /cancelled|canceled/i.test(raw)
        ? 'Device chooser closed. If the list was empty: power-cycle the trainer, click Connect (uses last permitted device), or open chrome://bluetooth-internals and disconnect leftovers.'
        : /no devices|not found|chooser|empty/i.test(raw)
          ? 'Chooser empty — trainer is probably not advertising (still linked from last session). Power-cycle the D100, use Connect (known device), quit Zwift, and avoid OS Bluetooth pairing.'
          : raw
      this.patch({
        connectionState: this.device ? 'disconnected-with-reconnect' : 'disconnected',
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
      // Fall back to known-device / chooser path if in-memory device is stale.
      const message = error instanceof Error ? error.message : String(error)
      this.patch({ lastError: `${message} — trying known devices…` })
      await this.connect()
    }
  }

  async disconnect(): Promise<void> {
    this.stopFreshnessTimer()
    if (this.device) {
      this.device.removeEventListener('gattserverdisconnected', this.onDisconnected)
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
    this.indoorBikeChar = null
    this.controlPointChar = null
    this.patch({
      connectionState: 'disconnected',
      deviceName: this.device?.name ?? null,
      watts: null,
      lastPowerAtMs: null,
      powerStatus: 'missing',
      cadenceRpm: null,
      speedKmh: null,
      ergControlAvailable: false,
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
    this.indoorBikeChar = null
    this.controlPointChar = null
    this.patch({
      connectionState: 'disconnected-with-reconnect',
      powerStatus:
        this.snapshot.lastPowerAtMs === null ? 'missing' : 'stale',
      lastError: 'Trainer disconnected. Reconnect or end the session.',
      ergControlAvailable: false,
    })
  }

  private async finishConnect(device: BluetoothDevice): Promise<void> {
    const server = await device.gatt!.connect()
    this.server = server

    const services = await server.getPrimaryServices()
    const serviceLabels = services.map((s) => uuidLabel(s.uuid))
    const characteristicLabels: string[] = []

    for (const service of services) {
      const chars = await service.getCharacteristics()
      for (const characteristic of chars) {
        characteristicLabels.push(`${uuidLabel(service.uuid)} / ${uuidLabel(characteristic.uuid)}`)
      }
    }

    const ftms = await server.getPrimaryService(FTMS_SERVICE)

    let features = null
    try {
      const featureChar = await ftms.getCharacteristic(FITNESS_MACHINE_FEATURE)
      const featureValue = await featureChar.readValue()
      features = parseFitnessMachineFeatures(featureValue)
    } catch (error) {
      this.appendProbe(
        `Feature read failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    this.indoorBikeChar = await ftms.getCharacteristic(INDOOR_BIKE_DATA)
    await this.indoorBikeChar.startNotifications()
    this.indoorBikeChar.addEventListener(
      'characteristicvaluechanged',
      this.onIndoorBikeData,
    )

    try {
      this.controlPointChar = await ftms.getCharacteristic(
        FITNESS_MACHINE_CONTROL_POINT,
      )
      await this.controlPointChar.startNotifications()
      this.controlPointChar.addEventListener(
        'characteristicvaluechanged',
        this.onControlPointResponse,
      )
    } catch {
      this.controlPointChar = null
      this.appendProbe('Control point characteristic not available.')
    }

    this.patch({
      connectionState: 'connected',
      deviceName: device.name ?? 'Unknown FTMS device',
      features,
      services: serviceLabels,
      characteristics: characteristicLabels,
      lastError: null,
    })

    this.startFreshnessTimer()
    await this.runControlProbe()
  }

  private onIndoorBikeData = (event: Event): void => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic
    const value = characteristic.value
    if (!value) return

    const parsed = parseIndoorBikeData(value)
    const nowMs = Date.now()
    const watts = parsed.instantaneousPowerWatts

    this.patch({
      watts: watts ?? this.snapshot.watts,
      lastPowerAtMs: watts !== null ? nowMs : this.snapshot.lastPowerAtMs,
      powerStatus:
        watts !== null
          ? 'fresh'
          : livePowerStatus({
              lastSampleAtMs: this.snapshot.lastPowerAtMs,
              nowMs,
              watts: this.snapshot.watts,
            }),
      cadenceRpm: parsed.instantaneousCadenceRpm,
      speedKmh: parsed.instantaneousSpeedKmh,
      lastIndoorBikeRaw: parsed.rawFields,
    })
  }

  private onControlPointResponse = (event: Event): void => {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic
    const value = characteristic.value
    if (!value || !this.controlResponseWaiter) return
    this.controlResponseWaiter.resolve(value)
    this.controlResponseWaiter = null
  }

  private waitForControlResponse(): Promise<DataView> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.controlResponseWaiter = null
        reject(new Error('Control-point response timed out'))
      }, CONTROL_RESPONSE_TIMEOUT_MS)

      this.controlResponseWaiter = {
        resolve: (view) => {
          clearTimeout(timer)
          resolve(view)
        },
        reject: (error) => {
          clearTimeout(timer)
          reject(error)
        },
      }
    })
  }

  private async runControlProbe(): Promise<void> {
    if (!this.controlPointChar) {
      this.appendProbe('Skipped Control Probe — no control point.')
      return
    }

    try {
      this.appendProbe('Request Control…')
      await this.controlPointChar.writeValueWithResponse(buildRequestControlCommand())
      const requestResponse = interpretControlPointResponse(
        await this.waitForControlResponse(),
      )
      this.appendProbe(
        `Request Control → ${requestResponse.message} (0x${requestResponse.resultCode.toString(16)})`,
      )
      if (!requestResponse.ok) return

      const targetSupported = this.snapshot.features?.targetPowerSupported ?? false
      if (!targetSupported) {
        this.appendProbe(
          'Target-power bit not set in features — display-only targets later; will not pretend to control resistance.',
        )
        return
      }

      const probeWatts =
        this.snapshot.watts !== null && this.snapshot.watts > 0
          ? this.snapshot.watts
          : DEFAULT_PROBE_WATTS

      this.appendProbe(`Set Target Power ${probeWatts} W…`)
      await this.controlPointChar.writeValueWithResponse(
        buildSetTargetPowerCommand(probeWatts),
      )
      const powerResponse = interpretControlPointResponse(
        await this.waitForControlResponse(),
      )
      this.appendProbe(
        `Set Target Power → ${powerResponse.message} (0x${powerResponse.resultCode.toString(16)})`,
      )
      if (!powerResponse.ok) {
        this.appendProbe(
          'Target power command rejected — app can show targets later but cannot set resistance on this firmware.',
        )
        this.patch({ ergControlAvailable: false })
      } else {
        this.appendProbe('Control Probe OK — target-power control accepted.')
        this.patch({ ergControlAvailable: true })
      }
    } catch (error) {
      this.appendProbe(
        `Control Probe error: ${error instanceof Error ? error.message : String(error)}`,
      )
      this.patch({ ergControlAvailable: false })
    }
  }

  /** Set trainer target power when ERG control is available. */
  async setTargetPower(watts: number): Promise<boolean> {
    if (!this.controlPointChar || !this.snapshot.ergControlAvailable) {
      return false
    }
    try {
      await this.controlPointChar.writeValueWithResponse(
        buildSetTargetPowerCommand(watts),
      )
      const response = interpretControlPointResponse(
        await this.waitForControlResponse(),
      )
      if (!response.ok) {
        this.patch({
          lastError: `Set Target Power failed: ${response.message}`,
        })
        return false
      }
      return true
    } catch (error) {
      this.patch({
        lastError:
          error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  private appendProbe(line: string): void {
    this.patch({ controlProbeLog: [...this.snapshot.controlProbeLog, line] })
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

  private patch(partial: Partial<TrainerSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial }
    for (const listener of this.listeners) {
      listener(this.snapshot)
    }
  }
}
