import { NotifySensorConnection } from '../ble/notifySensorConnection'
import { parseHeartRateMeasurement } from './parseHeartRateMeasurement'
import {
  initialHeartRateSnapshot,
  type HeartRateSnapshot,
} from './types'
import { HEART_RATE_MEASUREMENT, HEART_RATE_SERVICE } from './uuids'

export class HeartRateConnection extends NotifySensorConnection<HeartRateSnapshot> {
  protected readonly serviceUuid = HEART_RATE_SERVICE
  protected readonly characteristicUuid = HEART_RATE_MEASUREMENT
  protected readonly sensorLabel = 'heart rate monitor'
  protected readonly namePrefixes = [
    'Polar',
    'Garmin',
    'Wahoo',
    'TICKR',
    'HRM',
    'Coospo',
    'Magene',
  ]
  protected readonly knownNamePattern =
    /polar|garmin|wahoo|tickr|hrm|heart|coospo|magene|scosche|whoop/i

  protected createInitial(): HeartRateSnapshot {
    return initialHeartRateSnapshot()
  }

  protected valueKey(): keyof HeartRateSnapshot & string {
    return 'bpm'
  }

  protected onNotify(view: DataView): Partial<HeartRateSnapshot> {
    const parsed = parseHeartRateMeasurement(view)
    return {
      bpm: parsed.bpm,
      lastSampleAtMs: Date.now(),
      status: 'fresh',
    }
  }
}
