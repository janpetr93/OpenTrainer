import { NotifySensorConnection } from '../ble/notifySensorConnection'
import {
  cadenceRpmFromCrankDelta,
  uint16Delta,
} from './cadenceFromCrank'
import { parseCscMeasurement } from './parseCscMeasurement'
import {
  initialCadenceSnapshot,
  type CadenceSnapshot,
} from './types'
import { CSC_MEASUREMENT, CSC_SERVICE } from './uuids'

export class CadenceConnection extends NotifySensorConnection<CadenceSnapshot> {
  protected readonly serviceUuid = CSC_SERVICE
  protected readonly characteristicUuid = CSC_MEASUREMENT
  protected readonly sensorLabel = 'cadence sensor'
  protected readonly namePrefixes = [
    'Cadence',
    'CSC',
    'Magene',
    'Garmin',
    'Wahoo',
    'Bryton',
  ]
  protected readonly knownNamePattern =
    /cadence|csc|magene|garmin|wahoo|bryton|speed.?cad/i

  private lastCrankRevs: number | null = null
  private lastCrankEventTime: number | null = null

  protected createInitial(): CadenceSnapshot {
    return initialCadenceSnapshot()
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

    const rpm = cadenceRpmFromCrankDelta({
      revDelta: uint16Delta(revs, prevRevs),
      timeDeltaTicks: uint16Delta(eventTime, prevTime),
    })
    if (rpm === null) {
      return {}
    }

    return {
      rpm: Math.round(rpm),
      lastSampleAtMs: Date.now(),
      status: 'fresh',
    }
  }

  override async disconnect(): Promise<void> {
    this.lastCrankRevs = null
    this.lastCrankEventTime = null
    await super.disconnect()
  }
}
