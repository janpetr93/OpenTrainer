import type { PowerProfilePoint } from './api'
import { initialPowerMeterSnapshot, type PowerMeterSnapshot } from './cps'
import { initialCadenceSnapshot, type CadenceSnapshot } from './csc'
import type { PowerSourceMode } from './domain/powerSourceMode'
import { initialSnapshot, type TrainerSnapshot } from './ftms'
import { initialHeartRateSnapshot, type HeartRateSnapshot } from './hrm'
import type { RunnerSnapshot } from './workout/workoutRunner'

const STEPS = [
  { durationSec: 600, watts: 140 },
  { durationSec: 15, watts: 300 },
  { durationSec: 45, watts: 120 },
  { durationSec: 30, watts: 280 },
  { durationSec: 15, watts: 120 },
  { durationSec: 30, watts: 280 },
  { durationSec: 15, watts: 120 },
  { durationSec: 480, watts: 120 },
] as const

/** 12s into step 4, so 0:18 remains of the 0:30 effort. */
const ELAPSED_SEC = 672

export type RidePreview = {
  snapshot: TrainerSnapshot
  meter: PowerMeterSnapshot
  heartRate: HeartRateSnapshot
  cadence: CadenceSnapshot
  alignmentDelta: number
  powerSourceMode: PowerSourceMode
  runner: RunnerSnapshot
  plannedProfile: PowerProfilePoint[]
  targetProfile: null
  achievedProfile: PowerProfilePoint[]
  ftpWatts: number
}

function plannedProfile(): PowerProfilePoint[] {
  let tSec = 0
  const points: PowerProfilePoint[] = []
  for (const step of STEPS) {
    points.push({ tSec, watts: step.watts })
    tSec += step.durationSec
    points.push({ tSec, watts: step.watts })
  }
  return points
}

function wattsAt(tSec: number): number {
  let start = 0
  for (const step of STEPS) {
    if (tSec < start + step.durationSec) return step.watts
    start += step.durationSec
  }
  return STEPS[STEPS.length - 1].watts
}

function achievedProfile(): PowerProfilePoint[] {
  const points: PowerProfilePoint[] = []
  for (let tSec = 0; tSec <= ELAPSED_SEC; tSec += 30) {
    points.push(sample(tSec))
  }
  if (points[points.length - 1]?.tSec !== ELAPSED_SEC) {
    points.push(sample(ELAPSED_SEC))
  }
  return points
}

function sample(tSec: number): PowerProfilePoint {
  return {
    tSec,
    watts: tSec === ELAPSED_SEC ? 248 : wattsAt(tSec),
    cadenceRpm: tSec === ELAPSED_SEC ? 92 : 88,
    meterWatts: tSec === ELAPSED_SEC ? 251 : wattsAt(tSec) + 3,
  }
}

const FRAME: RidePreview = {
  snapshot: {
    ...initialSnapshot(),
    connectionState: 'connected',
    deviceName: 'D100',
    watts: 248,
    powerStatus: 'fresh',
    cadenceRpm: 92,
    lastError: null,
    webBluetoothSupported: true,
    ergControlAvailable: true,
    knownDevicesChecked: true,
  },
  meter: {
    ...initialPowerMeterSnapshot(),
    connectionState: 'connected',
    deviceName: 'Assioma Uno',
    watts: 251,
    powerStatus: 'fresh',
    lastError: null,
    webBluetoothSupported: true,
    knownDevicesChecked: true,
  },
  heartRate: {
    ...initialHeartRateSnapshot(),
    connectionState: 'connected',
    deviceName: 'HRM',
    bpm: null,
    status: 'missing',
    lastError: null,
    webBluetoothSupported: true,
    knownDevicesChecked: true,
  },
  cadence: {
    ...initialCadenceSnapshot(),
    webBluetoothSupported: true,
    knownDevicesChecked: true,
  },
  alignmentDelta: 3,
  powerSourceMode: 'trainer',
  runner: {
    status: 'running',
    workoutId: 'preview',
    workoutName: 'VO2 30/15',
    stepIndex: 3,
    stepCount: STEPS.length,
    stepType: 'steady',
    stepPlannedWatts: 280,
    stepTargetWatts: 280,
    intensityPercent: 100,
    stepRemainingSec: 18,
    elapsedSec: ELAPSED_SEC,
    totalSec: STEPS.reduce((sum, step) => sum + step.durationSec, 0),
    targetChanged: false,
    openStepBlocked: false,
  },
  plannedProfile: plannedProfile(),
  targetProfile: null,
  achievedProfile: achievedProfile(),
  ftpWatts: 200,
}

/** Frozen Ride screen for `?preview=ride` on the Vite dev server. Not an Activity. */
export function readRidePreview(search: string, dev: boolean): RidePreview | null {
  if (!dev) return null
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  if (params.get('preview') !== 'ride') return null
  return FRAME
}
