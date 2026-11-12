import type {
  PowerProfilePoint,
  Workout,
  WorkoutStep,
  WorkoutStepType,
} from '../api'
import {
  buildPlannedPowerProfile,
  truncatePowerProfile,
} from '../domain/plannedPowerProfile'
import { expandWorkoutItems } from '../domain/workoutItems'
import { resolveStepWatts, workoutNeedsFtp } from '../domain/resolveTarget'
import {
  DEFAULT_INTENSITY_PERCENT,
  applyIntensityToProfile,
  clampFreeRideTargetWatts,
  clampIntensityPercent,
  freeRideTargetProfile,
  scaleTargetWatts,
  type FreeRideTargetChange,
  type IntensityChange,
} from '../domain/rideIntensity'

export type RunnerStatus =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'stopped'

export type RunnerSnapshot = {
  status: RunnerStatus
  workoutId: string | null
  workoutName: string | null
  stepIndex: number
  stepCount: number
  stepType: WorkoutStepType | null
  /** Planned watts of the active step before Ride Intensity; null in a Free Ride. */
  stepPlannedWatts: number | null
  /**
   * Target the trainer should hold: planned × Ride Intensity in a Workout,
   * the rider-set watts in a Free Ride (null until set).
   */
  stepTargetWatts: number | null
  /** Ride Intensity percent (100 = as planned; always 100 in a Free Ride). */
  intensityPercent: number
  stepRemainingSec: number
  elapsedSec: number
  totalSec: number
  /** True when the active step target changed (start / skip / auto-advance). */
  targetChanged: boolean
  /** Simulation was rejected on the current Open Step, so the trainer stayed in ERG. */
  openStepBlocked: boolean
  /**
   * Elapsed second where a Workout continued as a Free Ride (button, last
   * step skipped, or plan ended); null otherwise. The ride and its recording
   * carry on until Stop.
   */
  freeRideFromSec: number | null
}

type FlatWorkout = Omit<Workout, 'steps'> & { steps: WorkoutStep[] }

type Internal = {
  workout: FlatWorkout | null
  /** Unstructured ride — no steps / ERG targets; stop ends the Activity. */
  freeRide: boolean
  ftpWatts: number | null
  status: RunnerStatus
  stepIndex: number
  /** Elapsed workout time excluding pauses. */
  elapsedSec: number
  /** Wall clock when the current running segment started. */
  segmentStartedAtMs: number
  /** Elapsed at the start of the current running segment. */
  elapsedAtSegmentStart: number
  targetChanged: boolean
  /** Planned step corners (current FTP at Start) on the elapsed timeline. */
  plannedProfile: PowerProfilePoint[]
  intensityPercent: number
  intensityChanges: IntensityChange[]
  freeRideTargetWatts: number | null
  freeRideTargetChanges: FreeRideTargetChange[]
  /** Set when a Workout continued as a Free Ride; the plan ends here. */
  freeRideFromSec: number | null
  simulationRejected: boolean
}

function totalDuration(steps: WorkoutStep[]): number {
  return steps.reduce((sum, s) => sum + s.durationSec, 0)
}

function stepBounds(steps: WorkoutStep[], stepIndex: number): {
  startSec: number
  endSec: number
  step: WorkoutStep
} {
  let startSec = 0
  for (let i = 0; i < stepIndex; i++) {
    startSec += steps[i]!.durationSec
  }
  const step = steps[stepIndex]!
  return { startSec, endSec: startSec + step.durationSec, step }
}

function resolvedTarget(
  step: WorkoutStep,
  ftpWatts: number | null,
): number | null {
  return resolveStepWatts(step, ftpWatts)
}

function idleState(): Internal {
  return {
    workout: null,
    freeRide: false,
    ftpWatts: null,
    status: 'idle',
    stepIndex: 0,
    elapsedSec: 0,
    segmentStartedAtMs: 0,
    elapsedAtSegmentStart: 0,
    targetChanged: false,
    plannedProfile: [],
    intensityPercent: DEFAULT_INTENSITY_PERCENT,
    intensityChanges: [],
    freeRideTargetWatts: null,
    freeRideTargetChanges: [],
    freeRideFromSec: null,
    simulationRejected: false,
  }
}

const IDLE_SNAPSHOT: RunnerSnapshot = {
  status: 'idle',
  workoutId: null,
  workoutName: null,
  stepIndex: 0,
  stepCount: 0,
  stepType: null,
  stepPlannedWatts: null,
  stepTargetWatts: null,
  intensityPercent: DEFAULT_INTENSITY_PERCENT,
  stepRemainingSec: 0,
  elapsedSec: 0,
  totalSec: 0,
  targetChanged: false,
  openStepBlocked: false,
  freeRideFromSec: null,
}

/** Record a change at an elapsed second; a second change in that second wins. */
function pushChange<T extends { tSec: number }>(changes: T[], change: T): T[] {
  const last = changes[changes.length - 1]
  if (last && last.tSec === change.tSec) {
    return [...changes.slice(0, -1), change]
  }
  return [...changes, change]
}

export class WorkoutRunner {
  private state: Internal = idleState()

  getSnapshot(): RunnerSnapshot {
    const {
      workout,
      freeRide,
      status,
      stepIndex,
      elapsedSec,
      targetChanged,
      ftpWatts,
      intensityPercent,
      freeRideTargetWatts,
    } = this.state
    if (status === 'idle') return { ...IDLE_SNAPSHOT }

    if (freeRide) {
      return {
        ...IDLE_SNAPSHOT,
        status,
        workoutName: 'Free Ride',
        stepTargetWatts: freeRideTargetWatts,
        elapsedSec: Math.floor(elapsedSec),
        targetChanged,
        freeRideFromSec: this.state.freeRideFromSec,
      }
    }

    if (!workout) return { ...IDLE_SNAPSHOT }

    const steps = workout.steps
    const totalSec = totalDuration(steps)
    const finished = status === 'completed' || status === 'stopped'
    const step = finished
      ? steps[Math.min(stepIndex, steps.length - 1)]!
      : stepBounds(steps, stepIndex).step
    const planned = resolvedTarget(step, ftpWatts)
    const target =
      planned === null ? null : scaleTargetWatts(planned, intensityPercent)
    const base = {
      status,
      workoutId: workout.id,
      workoutName: workout.name,
      stepIndex,
      stepCount: steps.length,
      stepType: step.type,
      stepPlannedWatts: planned,
      stepTargetWatts: target,
      intensityPercent,
      openStepBlocked:
        this.state.simulationRejected && step.type === 'open',
      totalSec,
      freeRideFromSec: null,
    }
    if (finished) {
      return {
        ...base,
        stepRemainingSec: 0,
        elapsedSec: Math.min(elapsedSec, totalSec),
        targetChanged: false,
      }
    }

    const { endSec } = stepBounds(steps, stepIndex)
    return {
      ...base,
      stepRemainingSec: Math.max(0, Math.ceil(endSec - elapsedSec)),
      elapsedSec: Math.floor(elapsedSec),
      targetChanged,
    }
  }

  /**
   * Targets the rider actually asked for, as step corners on the elapsed
   * timeline: the plan with Ride Intensity applied (carried to the plan's
   * end), or the Free Ride targets up to now. A Workout that continued as a
   * Free Ride gives the ridden part of the plan, then the Free Ride targets,
   * so the profile starts at 0 s like the plan. Null when the plan ran at
   * 100% throughout or no Free Ride target was set.
   */
  getTargetPowerProfile(): PowerProfilePoint[] | null {
    const { status, freeRide, workout, freeRideFromSec } = this.state
    if (status === 'idle') return null
    if (freeRide) {
      const points = freeRideTargetProfile(
        this.state.freeRideTargetChanges,
        Math.floor(this.state.elapsedSec),
      )
      if (workout && freeRideFromSec !== null) {
        const ridden = applyIntensityToProfile(
          truncatePowerProfile(this.state.plannedProfile, freeRideFromSec),
          this.state.intensityChanges,
        )
        const combined = [...ridden, ...points]
        return combined.length >= 2 ? combined : null
      }
      return points.length >= 2 ? points : null
    }
    if (!workout) return null
    const changes = this.state.intensityChanges
    if (changes.every((c) => c.percent === DEFAULT_INTENSITY_PERCENT)) {
      return null
    }
    return applyIntensityToProfile(this.state.plannedProfile, changes)
  }

  /** Ride Intensity for the current and every later step of a Workout. */
  setIntensity(percent: number, nowMs: number): void {
    const { status, freeRide, workout } = this.state
    if (status !== 'running' && status !== 'paused') return
    if (freeRide || !workout) return
    const step = stepBounds(workout.steps, this.state.stepIndex).step
    if (step.type === 'open') return
    const next = clampIntensityPercent(percent)
    if (next === this.state.intensityPercent) return
    this.syncElapsed(nowMs)
    this.state.intensityPercent = next
    this.state.intensityChanges = pushChange(this.state.intensityChanges, {
      tSec: Math.floor(this.state.elapsedSec),
      percent: next,
    })
    this.state.targetChanged = true
  }

  /** Free Ride ERG target in watts (held until changed or Stop). */
  setFreeRideTarget(watts: number, nowMs: number): void {
    const { status, freeRide } = this.state
    if (status !== 'running' && status !== 'paused') return
    if (!freeRide) return
    const next = clampFreeRideTargetWatts(watts)
    if (next === this.state.freeRideTargetWatts) return
    this.syncElapsed(nowMs)
    this.state.freeRideTargetWatts = next
    this.state.freeRideTargetChanges = pushChange(
      this.state.freeRideTargetChanges,
      { tSec: Math.floor(this.state.elapsedSec), watts: next },
    )
    this.state.targetChanged = true
  }

  /** Consume the targetChanged flag after the UI applies ERG. */
  clearTargetChanged(): void {
    this.state.targetChanged = false
  }

  /** Open Step could not leave ERG. The ride should pause on this step. */
  markSimulationRejected(): void {
    this.state.simulationRejected = true
  }

  clearSimulationRejected(): void {
    this.state.simulationRejected = false
  }

  start(
    workout: Workout,
    nowMs: number,
    ftpWatts: number | null = null,
  ): void {
    const steps = expandWorkoutItems(workout.steps)
    if (steps.length === 0) {
      throw new Error('Workout has no steps')
    }
    const flat: FlatWorkout = { ...workout, steps }
    if (workoutNeedsFtp(steps) && (ftpWatts === null || ftpWatts <= 0)) {
      throw new Error('Set FTP via MCP (set_ftp) before starting this Workout')
    }
    // Fail fast if any step cannot resolve.
    for (const step of steps) {
      resolveStepWatts(step, ftpWatts)
    }
    this.state = {
      ...idleState(),
      workout: flat,
      ftpWatts,
      status: 'running',
      segmentStartedAtMs: nowMs,
      targetChanged: true,
      plannedProfile: buildPlannedPowerProfile(steps, ftpWatts),
    }
  }

  /**
   * End the Workout here and keep riding as a Free Ride on the same clock and
   * recording. The trainer holds the current step's target until the rider
   * changes it; an Open Step leaves no target.
   */
  continueAsFreeRide(nowMs: number): void {
    const { status, freeRide, workout } = this.state
    if (status !== 'running' && status !== 'paused') return
    if (freeRide || !workout) return
    this.syncElapsed(nowMs)
    const step = stepBounds(workout.steps, this.state.stepIndex).step
    this.switchToFreeRide(Math.floor(this.state.elapsedSec), step)
  }

  startFreeRide(nowMs: number): void {
    this.state = {
      ...idleState(),
      freeRide: true,
      status: 'running',
      segmentStartedAtMs: nowMs,
    }
  }

  pause(nowMs: number): void {
    if (this.state.status !== 'running') return
    this.syncElapsed(nowMs)
    this.state.status = 'paused'
  }

  resume(nowMs: number): void {
    if (this.state.status !== 'paused') return
    this.state.status = 'running'
    this.state.segmentStartedAtMs = nowMs
    this.state.elapsedAtSegmentStart = this.state.elapsedSec
    const workout = this.state.workout
    if (
      workout &&
      stepBounds(workout.steps, this.state.stepIndex).step.type === 'open'
    ) {
      this.state.targetChanged = true
    }
  }

  skip(nowMs: number): void {
    if (this.state.status !== 'running' && this.state.status !== 'paused') return
    if (this.state.freeRide || !this.state.workout) return
    this.syncElapsed(nowMs)
    const next = this.state.stepIndex + 1
    if (next >= this.state.workout.steps.length) {
      // Same clock as the button: the skipped tail is not ridden and not planned.
      this.continueAsFreeRide(nowMs)
      return
    }
    const { startSec } = stepBounds(this.state.workout.steps, next)
    this.state.stepIndex = next
    this.state.elapsedSec = startSec
    this.state.elapsedAtSegmentStart = startSec
    this.state.segmentStartedAtMs = nowMs
    this.state.status = 'running'
    this.state.targetChanged = true
    this.state.simulationRejected = false
  }

  stop(nowMs: number): void {
    if (this.state.status === 'idle') return
    this.syncElapsed(nowMs)
    this.state.status = 'stopped'
    this.state.targetChanged = false
  }

  tick(nowMs: number): void {
    if (this.state.status !== 'running') return
    if (this.state.freeRide) {
      this.syncElapsed(nowMs)
      return
    }
    if (!this.state.workout) return
    this.syncElapsed(nowMs)
    this.advanceSteps(nowMs)
  }

  /** Leave the plan at `fromSec`, holding `step`'s ridden target in ERG. */
  private switchToFreeRide(fromSec: number, step: WorkoutStep): void {
    const planned = resolvedTarget(step, this.state.ftpWatts)
    const seed =
      planned === null
        ? null
        : clampFreeRideTargetWatts(
            scaleTargetWatts(planned, this.state.intensityPercent),
          )
    this.state.freeRide = true
    this.state.freeRideFromSec = fromSec
    this.state.freeRideTargetWatts = seed
    this.state.freeRideTargetChanges =
      seed === null ? [] : [{ tSec: fromSec, watts: seed }]
    this.state.simulationRejected = false
    this.state.targetChanged = true
  }

  private syncElapsed(nowMs: number): void {
    if (this.state.status !== 'running') return
    const deltaSec = (nowMs - this.state.segmentStartedAtMs) / 1000
    this.state.elapsedSec = this.state.elapsedAtSegmentStart + deltaSec
  }

  private advanceSteps(nowMs: number): void {
    const workout = this.state.workout
    if (!workout) return

    while (this.state.stepIndex < workout.steps.length) {
      const { endSec } = stepBounds(workout.steps, this.state.stepIndex)
      if (this.state.elapsedSec < endSec) break
      const next = this.state.stepIndex + 1
      if (next >= workout.steps.length) {
        // The plan is done; the ride goes on as a Free Ride until Stop.
        this.switchToFreeRide(
          totalDuration(workout.steps),
          workout.steps[this.state.stepIndex]!,
        )
        return
      }
      this.state.stepIndex = next
      this.state.targetChanged = true
      this.state.simulationRejected = false
      this.state.elapsedAtSegmentStart = this.state.elapsedSec
      this.state.segmentStartedAtMs = nowMs
    }
  }
}
