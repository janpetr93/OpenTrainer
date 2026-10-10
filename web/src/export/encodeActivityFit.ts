import {
  FitConstants,
  FitEncoder,
  FitMessages,
  Message,
} from 'fit-encoder'
import type { Activity, PowerProfilePoint } from '../api'

export type FitSample = {
  power: number
  heartRate: number | undefined
  cadence: number | undefined
}

/** Hold-forward power; HR/cadence only when a sample carried them (else FIT invalid). */
export function expandFitSamples(
  profile: PowerProfilePoint[],
  durationSec: number,
): FitSample[] {
  if (profile.length === 0 || durationSec <= 0) return []
  const sorted = [...profile].sort((a, b) => a.tSec - b.tSec)
  const out: FitSample[] = []
  let i = 0
  let watts = Math.round(sorted[0]!.watts)
  for (let t = 0; t <= durationSec; t++) {
    while (i + 1 < sorted.length && sorted[i + 1]!.tSec <= t) {
      i++
      watts = Math.round(sorted[i]!.watts)
    }
    if (sorted[i]!.tSec <= t) {
      watts = Math.round(sorted[i]!.watts)
    }
    const at = sorted[i]!
    const exact = at.tSec === t
    out.push({
      power: watts,
      heartRate:
        exact && at.hrBpm !== null && at.hrBpm !== undefined
          ? Math.round(at.hrBpm)
          : undefined,
      cadence:
        exact && at.cadenceRpm !== null && at.cadenceRpm !== undefined
          ? Math.round(at.cadenceRpm)
          : undefined,
    })
  }
  return out
}

/** @deprecated use expandFitSamples — kept for tests that assert power series. */
export function expandPowerSeries(
  profile: PowerProfilePoint[],
  durationSec: number,
): number[] {
  return expandFitSamples(profile, durationSec).map((s) => s.power)
}

class IndoorActivityEncoder extends FitEncoder {
  constructor(activity: Activity, samples: FitSample[]) {
    super()

    const includeSensors = samples.some(
      (s) => s.heartRate !== undefined || s.cadence !== undefined,
    )

    const start = new Date(activity.startedAt)
    const startFit = FitEncoder.toFitTimestamp(start)
    const endFit = startFit + Math.max(samples.length - 1, 0)
    const elapsedMs = Math.max(activity.durationSec, samples.length - 1) * 1000
    const powers = samples.map((s) => s.power)

    const avg =
      activity.averagePowerWatts ??
      Math.round(powers.reduce((a, b) => a + b, 0) / powers.length)
    const max = activity.maxPowerWatts ?? Math.max(...powers)

    const fileId = new Message(
      FitConstants.mesg_num.file_id,
      FitMessages.file_id,
      'time_created',
      'manufacturer',
      'product',
      'type',
    )
    const event = new Message(
      FitConstants.mesg_num.event,
      FitMessages.event,
      'timestamp',
      'data',
      'event',
      'event_type',
    )
    const deviceInfo = new Message(
      FitConstants.mesg_num.device_info,
      FitMessages.device_info,
      'timestamp',
      'product_name',
      'manufacturer',
      'product',
      'device_index',
    )
    const sport = new Message(
      FitConstants.mesg_num.sport,
      FitMessages.sport,
      'sport',
      'sub_sport',
    )
    const record = includeSensors
      ? new Message(
          FitConstants.mesg_num.record,
          FitMessages.record,
          'timestamp',
          'power',
          'heart_rate',
          'cadence',
        )
      : new Message(
          FitConstants.mesg_num.record,
          FitMessages.record,
          'timestamp',
          'power',
        )
    const session = new Message(
      FitConstants.mesg_num.session,
      FitMessages.session,
      'timestamp',
      'start_time',
      'total_elapsed_time',
      'total_timer_time',
      'avg_power',
      'max_power',
      'event',
      'event_type',
      'sport',
      'sub_sport',
    )
    const activityMsg = new Message(
      FitConstants.mesg_num.activity,
      FitMessages.activity,
      'total_timer_time',
      'local_timestamp',
      'num_sessions',
      'type',
      'event',
      'event_type',
    )

    fileId.writeDataMessage(
      startFit,
      FitConstants.manufacturer.development,
      0,
      FitConstants.file.activity,
    )

    event.writeDataMessage(
      startFit,
      0,
      FitConstants.event.timer,
      FitConstants.event_type.start,
    )

    deviceInfo.writeDataMessage(
      startFit,
      'OpenTrainer',
      FitConstants.manufacturer.development,
      0,
      FitConstants.device_index.creator,
    )

    sport.writeDataMessage(
      FitConstants.sport.cycling,
      FitConstants.sub_sport.indoor_cycling,
    )

    for (let ix = 0; ix < samples.length; ix++) {
      const sample = samples[ix]!
      if (includeSensors) {
        record.writeDataMessage(
          startFit + ix,
          sample.power,
          sample.heartRate,
          sample.cadence,
        )
      } else {
        record.writeDataMessage(startFit + ix, sample.power)
      }
    }

    event.writeDataMessage(
      endFit,
      0,
      FitConstants.event.timer,
      FitConstants.event_type.stop_all,
    )

    session.writeDataMessage(
      endFit,
      startFit,
      elapsedMs, // scale 1000 → seconds in FIT tools
      elapsedMs,
      avg,
      max,
      FitConstants.event.session,
      FitConstants.event_type.stop,
      FitConstants.sport.cycling,
      FitConstants.sub_sport.indoor_cycling,
    )

    activityMsg.writeDataMessage(
      elapsedMs / 1000,
      startFit,
      1,
      FitConstants.activity.manual,
      FitConstants.event.activity,
      FitConstants.event_type.stop,
    )
  }
}

/** Encode an Activity as an indoor-cycling FIT file (power + optional HR/cadence). */
export function encodeActivityFit(activity: Activity): Uint8Array {
  const durationSec = Math.max(
    activity.durationSec,
    activity.achievedPowerProfile.at(-1)?.tSec ?? 0,
  )
  const samples = expandFitSamples(activity.achievedPowerProfile, durationSec)
  if (samples.length === 0) {
    throw new Error('Cannot export FIT without recorded power samples')
  }

  const encoder = new IndoorActivityEncoder(activity, samples)
  const file = encoder.getFile()
  return file instanceof Uint8Array ? file : new Uint8Array(file)
}

export function activityFitFilename(activity: Activity): string {
  const stamp = activity.startedAt.replace(/[:.]/g, '-').replace(/Z$/, '')
  return `open-trainer-indoor-${stamp}.fit`
}
