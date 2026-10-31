import { COGGAN_ZONES, type PowerZoneId } from './cogganZones.js'
import type { SessionAdherence } from './sessionAdherence.js'
import type { SessionLoad, TimeInZonesSec } from './sessionLoad.js'
import type {
  ScheduledRideStatus,
  WorkoutItem,
  WorkoutStep,
} from './types.js'
import { expandWorkoutItems } from './workoutItems.js'

/** Achieved time at or above Coggan Z4 that marks a Free Ride as hard. */
const FREE_RIDE_HARD_SEC = 300

export type SessionKind = 'easy' | 'moderate' | 'hard'

export type TrainingSummaryActivityInput = {
  id: string
  startedAt: string
  durationSec: number
  purpose: string | null
  averagePowerWatts: number | null
  workoutId: string | null
  sessionLoad: SessionLoad | null
  sessionAdherence: SessionAdherence | null
}

export type TrainingSummaryWorkout = {
  id: string
  name: string
  steps: WorkoutItem[]
}

export type TrainingSummaryRide = {
  id: string
  startsAt: string
  status: ScheduledRideStatus
  missed: boolean
  purpose: string | null
  workoutId: string
}

export type TrainingSummaryActivity = {
  id: string
  startedAt: string
  durationSec: number
  purpose: string | null
  averagePowerWatts: number | null
  /** Prescription class. Free Rides use achieved time in Z4–Z7. */
  kind: SessionKind
  normalizedPowerWatts: number | null
  intensityFactor: number | null
  trainingStressScore: number | null
  timeInZonesSec: TimeInZonesSec | null
  adherence: SessionAdherence | null
  workout: TrainingSummaryWorkout | null
}

export type TrainingSummaryRollup = {
  activityCount: number
  tssSum: number
  ridesMissingTss: number
  /** Zones 1+2, under 75% FTP. */
  easySec: number
  /** Zone 3, 75–90% FTP. */
  moderateSec: number
  /** Zone 4, 90–105% FTP. */
  thresholdSec: number
  /** Zones 5+6+7, above 105% FTP. */
  aboveSec: number
  hardSessionCount: number
  missedCount: number
  skippedCount: number
  lastHard: {
    id: string
    startedAt: string
    targetAdherence: number | null
  } | null
}

export type TrainingSummary = {
  activities: TrainingSummaryActivity[]
  scheduledRides: TrainingSummaryRide[]
  rollup: TrainingSummaryRollup
}

function zoneMidpointPercent(zone: PowerZoneId): number {
  const band = COGGAN_ZONES.find((z) => z.zone === zone)
  if (!band) return 0
  if (band.maxPercentFtp === null) return band.minPercentFtp * 1.1
  return (band.minPercentFtp + band.maxPercentFtp) / 2
}

/** Percent of FTP a step will demand. Null when it cannot be known. */
export function stepPercentFtp(
  step: WorkoutStep,
  ftpWatts: number | null,
): number | null {
  if (step.percentFtp !== null && step.percentFtp !== undefined) {
    return step.percentFtp
  }
  if (step.zone !== null && step.zone !== undefined) {
    return zoneMidpointPercent(step.zone)
  }
  if (
    step.targetWatts !== null &&
    step.targetWatts !== undefined &&
    ftpWatts !== null &&
    ftpWatts > 0
  ) {
    return (step.targetWatts / ftpWatts) * 100
  }
  return null
}

function leafSteps(items: readonly WorkoutItem[]): WorkoutStep[] {
  const leaves: WorkoutStep[] = []
  for (const item of items) {
    if (item.type === 'repeat') leaves.push(...item.steps)
    else leaves.push(item)
  }
  return leaves
}

export function sessionKind(
  items: readonly WorkoutItem[] | null,
  timeInZonesSec: TimeInZonesSec | null,
  ftpWatts: number | null,
): SessionKind {
  if (items === null) {
    if (!timeInZonesSec) return 'easy'
    const hardSec =
      timeInZonesSec[4] + timeInZonesSec[5] + timeInZonesSec[6] + timeInZonesSec[7]
    return hardSec >= FREE_RIDE_HARD_SEC ? 'hard' : 'easy'
  }

  const steady = expandWorkoutItems(items).filter((step) => step.type === 'steady')
  let hard = false
  let moderate = false
  let shortHard = 0
  for (const step of steady) {
    const pct = stepPercentFtp(step, ftpWatts)
    if (pct === null) continue
    if (pct >= 88) hard = true
    if (pct >= 76 && pct <= 94) moderate = true
    if (step.durationSec <= 45 && pct >= 110) shortHard += 1
  }
  if (shortHard >= 6) hard = true
  if (hard) return 'hard'
  if (moderate) return 'moderate'
  return 'easy'
}

/** Steady work sits in the 76–94% FTP band (tempo or sweet spot). */
export function inModerateBand(
  items: readonly WorkoutItem[],
  ftpWatts: number | null,
): boolean {
  return expandWorkoutItems(items)
    .filter((step) => step.type === 'steady')
    .some((step) => {
      const pct = stepPercentFtp(step, ftpWatts)
      return pct !== null && pct >= 76 && pct <= 94
    })
}

export function prescriptionViolations(
  workoutName: string,
  items: readonly WorkoutItem[],
): string[] {
  const violations: string[] = []
  for (const step of leafSteps(items)) {
    if (step.zone !== null && step.zone !== undefined && step.zone >= 6) {
      violations.push(
        `${workoutName} uses zone ${step.zone}. Do not use zone 6 or 7; ERG cannot sprint.`,
      )
    } else if (step.zone !== null && step.zone !== undefined && step.zone >= 3) {
      violations.push(
        `${workoutName} uses zone ${step.zone}. A zone number is the band midpoint; use percentFtp.`,
      )
    }
    if (
      step.percentFtp !== null &&
      step.percentFtp !== undefined &&
      step.percentFtp >= 150
    ) {
      violations.push(
        `${workoutName} has a step at ${step.percentFtp}% FTP. ERG cannot sprint.`,
      )
    } else if (
      step.percentFtp !== null &&
      step.percentFtp !== undefined &&
      step.percentFtp >= 120 &&
      step.durationSec > 60
    ) {
      violations.push(
        `${workoutName} has a ${step.durationSec}s step at ${step.percentFtp}% FTP. Keep work at or above 120% FTP to short repeats.`,
      )
    }
  }
  return violations
}

function localDayIndex(iso: string): number {
  const d = new Date(iso)
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000
}

function localDateKey(iso: string): string {
  const d = new Date(iso)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

export type WeekCheckRide = {
  id: string
  startsAt: string
  status: ScheduledRideStatus
  workout: TrainingSummaryWorkout | null
}

export type WeekCheck = {
  hardCount: number
  hardCap: number
  moderateBandCount: number
  violations: string[]
}

export function checkTrainingWeek(input: {
  rides: readonly WeekCheckRide[]
  ftpWatts: number | null
  maxHardDaysPerWeek: number | null
}): WeekCheck {
  const active = input.rides.filter((ride) => ride.status !== 'skipped')
  const hardCap = input.maxHardDaysPerWeek ?? 2
  const violations: string[] = []
  const hardRides: WeekCheckRide[] = []
  let moderateBandCount = 0

  for (const ride of active) {
    if (!ride.workout) {
      violations.push(`Scheduled Ride ${ride.id} has no Workout.`)
      continue
    }
    violations.push(
      ...prescriptionViolations(ride.workout.name, ride.workout.steps),
    )
    const kind = sessionKind(ride.workout.steps, null, input.ftpWatts)
    if (kind === 'hard') hardRides.push(ride)
    if (inModerateBand(ride.workout.steps, input.ftpWatts)) moderateBandCount += 1
  }

  if (hardRides.length > hardCap) {
    violations.push(
      `${hardRides.length} hard sessions; the cap is ${hardCap}.`,
    )
  }
  if (moderateBandCount > 2) {
    violations.push(
      `${moderateBandCount} sessions include steady work at 76-94% FTP; keep that to at most 2.`,
    )
  }

  const ordered = [...hardRides].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1]!
    const next = ordered[i]!
    const gap = localDayIndex(next.startsAt) - localDayIndex(prev.startsAt)
    if (gap <= 0) {
      violations.push(
        `Hard sessions on ${localDateKey(prev.startsAt)} are on the same day.`,
      )
    } else if (gap === 1) {
      violations.push(
        `Hard sessions on ${localDateKey(prev.startsAt)} and ${localDateKey(next.startsAt)} have no easy day between them.`,
      )
    }
  }

  return {
    hardCount: hardRides.length,
    hardCap,
    moderateBandCount,
    violations,
  }
}

function emptyZones(): TimeInZonesSec {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }
}

export function buildTrainingSummary(input: {
  activities: readonly TrainingSummaryActivityInput[]
  workouts: readonly TrainingSummaryWorkout[]
  scheduledRides: readonly TrainingSummaryRide[]
  ftpWatts: number | null
}): TrainingSummary {
  const workoutById = new Map(input.workouts.map((workout) => [workout.id, workout]))
  const zones = emptyZones()
  let tssSum = 0
  let ridesMissingTss = 0
  let lastHard: TrainingSummaryRollup['lastHard'] = null

  const activities = [...input.activities]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((activity): TrainingSummaryActivity => {
      const workout = activity.workoutId
        ? (workoutById.get(activity.workoutId) ?? null)
        : null
      const load = activity.sessionLoad
      if (load) {
        for (const zone of [1, 2, 3, 4, 5, 6, 7] as const) {
          zones[zone] += load.timeInZonesSec[zone]
        }
        if (load.trainingStressScore === null) ridesMissingTss += 1
        else tssSum += load.trainingStressScore
      } else {
        ridesMissingTss += 1
      }
      const kind = sessionKind(
        workout ? workout.steps : null,
        load?.timeInZonesSec ?? null,
        input.ftpWatts,
      )
      if (kind === 'hard') {
        lastHard = {
          id: activity.id,
          startedAt: activity.startedAt,
          targetAdherence: activity.sessionAdherence?.targetAdherence ?? null,
        }
      }
      return {
        id: activity.id,
        startedAt: activity.startedAt,
        durationSec: activity.durationSec,
        purpose: activity.purpose,
        averagePowerWatts: activity.averagePowerWatts,
        kind,
        normalizedPowerWatts: load?.normalizedPowerWatts ?? null,
        intensityFactor: load?.intensityFactor ?? null,
        trainingStressScore: load?.trainingStressScore ?? null,
        timeInZonesSec: load?.timeInZonesSec ?? null,
        adherence: activity.sessionAdherence,
        workout,
      }
    })

  const hardSessionCount = activities.filter((activity) => activity.kind === 'hard').length

  return {
    activities,
    scheduledRides: [...input.scheduledRides],
    rollup: {
      activityCount: activities.length,
      tssSum: Math.round(tssSum * 100) / 100,
      ridesMissingTss,
      easySec: zones[1] + zones[2],
      moderateSec: zones[3],
      thresholdSec: zones[4],
      aboveSec: zones[5] + zones[6] + zones[7],
      hardSessionCount,
      missedCount: input.scheduledRides.filter((ride) => ride.missed).length,
      skippedCount: input.scheduledRides.filter((ride) => ride.status === 'skipped')
        .length,
      lastHard,
    },
  }
}
