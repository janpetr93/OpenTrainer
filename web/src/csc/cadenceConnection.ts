import { NotifySensorConnection } from '../ble/notifySensorConnection'
import {
  rememberedDeviceStore,
  type DeviceRole,
  type RememberedDeviceStore,
} from '../ble/rememberedDevices'
import {
  cadenceRpmFromCrankDelta,
  uint16Delta,
} from './cadenceFromCrank'
import {
  isCadenceBridgeUnavailable,
  nativeCadenceLink,
  type NativeCadenceLink,
} from './nativeCadence'
import { parseCscMeasurement } from './parseCscMeasurement'
import {
  initialCadenceSnapshot,
  type CadenceSnapshot,
} from './types'
import { CSC_MEASUREMENT, CSC_SERVICE } from './uuids'

const SPEED_MODE_ERROR =
  'This sensor is in speed mode. Take the battery out and put it back in until the light is red — that is cadence.'

const WHEEL_REVOLUTION_FLAG = 1 << 0

/** Don't call a short gap between crank strokes a stop. */
const MIN_COAST_MS = 1200
/** A stop from a slow cadence still clears within this long. */
const MAX_COAST_MS = 3000
const COAST_TICK_MS = 250

type ConnectOptions = {
  acceptAllDevices?: boolean
  forceChooser?: boolean
  deviceId?: string
  /** Re-pair all: connect the remembered id or exact name without the list when it is advertising. */
  autoRepair?: boolean
}

export class CadenceConnection extends NotifySensorConnection<CadenceSnapshot> {
  protected readonly serviceUuid = CSC_SERVICE
  protected readonly characteristicUuid = CSC_MEASUREMENT
  protected readonly sensorLabel = 'cadence sensor'
  protected readonly namePrefixes = [
    'Cadence',
    'CAD',
    'CSC',
    'Magene',
    'Garmin',
    'Wahoo',
    'Bryton',
    'BK',
    'Coospo',
    'XOSS',
    'iGP',
    'CYCPLUS',
    'MOOFIT',
  ]
  protected readonly knownNamePattern =
    /cadence|csc|^cad|magene|garmin|wahoo|bryton|speed.?cad|coospo|xoss|igpsport|cycplus|moofit|^bk\d/i

  private lastCrankRevs: number | null = null
  private lastCrankEventTime: number | null = null
  /** Milliseconds per crank revolution from the latest moving sample. */
  private lastRevPeriodMs = 1000
  private coastTimer: ReturnType<typeof setInterval> | null = null
  private nativeUnsub: (() => void) | null = null
  private nativeDisc: (() => void) | null = null
  private readonly native: NativeCadenceLink | null

  constructor(
    remembered: RememberedDeviceStore = rememberedDeviceStore(),
    native: NativeCadenceLink | null = nativeCadenceLink(),
  ) {
    super(remembered)
    this.native = native
  }

  protected createInitial(): CadenceSnapshot {
    return initialCadenceSnapshot()
  }

  protected deviceRole(): DeviceRole {
    return 'cadence'
  }

  protected valueKey(): keyof CadenceSnapshot & string {
    return 'rpm'
  }

  protected onNotify(view: DataView): Partial<CadenceSnapshot> {
    const parsed = parseCscMeasurement(view)
    if (
      parsed.cumulativeCrankRevs === null ||
      parsed.lastCrankEventTime === null
    ) {
      if (
        parsed.rawFlags & WHEEL_REVOLUTION_FLAG &&
        this.snapshot.lastError !== SPEED_MODE_ERROR
      ) {
        return { lastError: SPEED_MODE_ERROR }
      }
      return {}
    }

    const revs = parsed.cumulativeCrankRevs
    const eventTime = parsed.lastCrankEventTime
    const prevRevs = this.lastCrankRevs
    const prevTime = this.lastCrankEventTime
    this.lastCrankRevs = revs
    this.lastCrankEventTime = eventTime

    if (prevRevs === null || prevTime === null) {
      return {}
    }

    const revDelta = uint16Delta(revs, prevRevs)
    const timeDeltaTicks = uint16Delta(eventTime, prevTime)
    // A repeated count is not a new stroke. Leave the last rpm; the coast
    // timer clears it once the crank has actually been still.
    if (revDelta === 0) {
      return {}
    }

    const rpm = cadenceRpmFromCrankDelta({ revDelta, timeDeltaTicks })
    if (rpm === null) {
      return {}
    }

    this.lastRevPeriodMs = (timeDeltaTicks / revDelta / 1024) * 1000
    return {
      rpm: Math.round(rpm),
      lastSampleAtMs: Date.now(),
      status: 'fresh',
      lastError: null,
    }
  }

  override async connect(options: ConnectOptions = {}): Promise<void> {
    if (!this.native) {
      await super.connect(options)
      return
    }
    try {
      await this.connectNative(options)
    } catch (error) {
      if (isCadenceBridgeUnavailable(error)) {
        await super.connect(options)
        return
      }
      this.failNative(error)
    }
  }

  override async reconnect(): Promise<void> {
    if (this.native) {
      await this.connect()
      return
    }
    await super.reconnect()
  }

  override async disconnect(): Promise<void> {
    this.stopNativeSubscriptions()
    await this.native?.disconnect()
    this.lastCrankRevs = null
    this.lastCrankEventTime = null
    this.lastRevPeriodMs = 1000
    await super.disconnect()
  }

  protected override startFreshnessTimer(): void {
    super.startFreshnessTimer()
    this.stopCoastTimer()
    this.coastTimer = setInterval(() => this.dropIfCoasting(), COAST_TICK_MS)
  }

  protected override stopFreshnessTimer(): void {
    this.stopCoastTimer()
    super.stopFreshnessTimer()
  }

  private stoppedCrank(): Partial<CadenceSnapshot> {
    return {
      rpm: 0,
      lastSampleAtMs: Date.now(),
      status: 'fresh',
      lastError: null,
    }
  }

  /**
   * CSC sensors stop notifying when the crank stops, so the last rpm would
   * otherwise stay on screen. Wait about two strokes, then show zero.
   */
  private dropIfCoasting(): void {
    const { connectionState, rpm, lastSampleAtMs, lastError } = this.snapshot
    if (connectionState !== 'connected' || lastError) return
    if (rpm === null || rpm === 0 || lastSampleAtMs === null) return
    const limit = Math.min(
      MAX_COAST_MS,
      Math.max(MIN_COAST_MS, this.lastRevPeriodMs * 2),
    )
    if (Date.now() - lastSampleAtMs < limit) return
    this.patch(this.stoppedCrank())
  }

  private stopCoastTimer(): void {
    if (this.coastTimer !== null) {
      clearInterval(this.coastTimer)
      this.coastTimer = null
    }
  }

  private async connectNative(options: ConnectOptions): Promise<void> {
    this.lastCrankRevs = null
    this.lastCrankEventTime = null
    this.lastRevPeriodMs = 1000
    this.stopNativeSubscriptions()
    this.patch({ connectionState: 'connecting', lastError: null })

    const shortcut = !options.forceChooser && !options.acceptAllDevices
    const remembered = shortcut ? this.snapshot.rememberedDevice : null
    const deviceId = options.deviceId ?? remembered?.id
    const name = options.autoRepair ? remembered?.name ?? undefined : undefined
    const native = this.native
    if (!native) return

    this.nativeUnsub = native.onMeasurement((bytes) => {
      const copy = Uint8Array.from(bytes)
      this.patch(this.onNotify(new DataView(copy.buffer)))
    })
    this.nativeDisc = native.onDisconnected(() => this.onNativeDisconnected())

    try {
      const selected = await native.connect({
        ...(deviceId ? { deviceId } : {}),
        ...(name ? { name } : {}),
      })
      this.patch({
        connectionState: 'connected',
        deviceName: selected.name ?? 'Cadence sensor',
        lastError: null,
        rememberedDevice: this.remembered.remember(this.deviceRole(), {
          id: selected.id,
          name: selected.name,
        }),
      })
      this.startFreshnessTimer()
    } catch (error) {
      this.stopNativeSubscriptions()
      throw error
    }
  }

  private onNativeDisconnected = (): void => {
    this.stopFreshnessTimer()
    this.lastCrankRevs = null
    this.lastCrankEventTime = null
    this.patch({
      connectionState: 'disconnected-with-reconnect',
      status: this.snapshot.lastSampleAtMs === null ? 'missing' : 'stale',
      lastError: 'cadence sensor disconnected. Reconnect when ready.',
    })
  }

  private failNative(error: unknown): void {
    const raw = error instanceof Error ? error.message : String(error)
    const message = /chooser closed|cancelled|canceled/i.test(raw)
      ? 'cadence sensor chooser closed. Wake the sensor, then try again.'
      : raw
    this.stopFreshnessTimer()
    this.patch({
      connectionState: this.snapshot.deviceName
        ? 'disconnected-with-reconnect'
        : 'disconnected',
      lastError: message,
    })
  }

  private stopNativeSubscriptions(): void {
    this.nativeUnsub?.()
    this.nativeDisc?.()
    this.nativeUnsub = null
    this.nativeDisc = null
  }
}
