import type { Workout, WorkoutStep, WorkoutStepType } from '../api'
import { expandWorkoutItems } from '../domain/workoutItems'
import { resolveStepWatts, workoutNeedsFtp } from '../domain/resolveTarget'

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
  stepTargetWatts: number | null
  stepRemainingSec: number
  elapsedSec: number
  totalSec: number
  /** True when the active step target changed (start / skip / auto-advance). */
  targetChanged: boolean
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

export class WorkoutRunner {
  private state: Internal = {
    workout: null,
    freeRide: false,
    ftpWatts: null,
    status: 'idle',
    stepIndex: 0,
    elapsedSec: 0,
    segmentStartedAtMs: 0,
    elapsedAtSegmentStart: 0,
    targetChanged: false,
  }

  getSnapshot(): RunnerSnapshot {
    const {
      workout,
      freeRide,
      status,
      stepIndex,
      elapsedSec,
      targetChanged,
      ftpWatts,
    } = this.state
    if (status === 'idle') {
      return {
        status: 'idle',
        workoutId: null,
        workoutName: null,
        stepIndex: 0,
        stepCount: 0,
        stepType: null,
        stepTargetWatts: null,
        stepRemainingSec: 0,
        elapsedSec: 0,
        totalSec: 0,
        targetChanged: false,
      }
    }

    if (freeRide) {
      return {
        status,
        workoutId: null,
        workoutName: 'Free Ride',
        stepIndex: 0,
        stepCount: 0,
        stepType: null,
        stepTargetWatts: null,
        stepRemainingSec: 0,
        elapsedSec: Math.floor(elapsedSec),
        totalSec: 0,
        targetChanged: false,
      }
    }

    if (!workout) {
      return {
        status: 'idle',
        workoutId: null,
        workoutName: null,
        stepIndex: 0,
        stepCount: 0,
        stepType: null,
        stepTargetWatts: null,
        stepRemainingSec: 0,
        elapsedSec: 0,
        totalSec: 0,
        targetChanged: false,
      }
    }

    const steps = workout.steps
    const totalSec = totalDuration(steps)
    if (status === 'completed' || status === 'stopped') {
      const last = steps[Math.min(stepIndex, steps.length - 1)]!
      return {
        status,
        workoutId: workout.id,
        workoutName: workout.name,
        stepIndex,
        stepCount: steps.length,
        stepType: last.type,
        stepTargetWatts: resolvedTarget(last, ftpWatts),
        stepRemainingSec: 0,
        elapsedSec: Math.min(elapsedSec, totalSec),
        totalSec,
        targetChanged: false,
      }
    }

    const { endSec, step } = stepBounds(steps, stepIndex)
    return {
      status,
      workoutId: workout.id,
      workoutName: workout.name,
      stepIndex,
      stepCount: steps.length,
      stepType: step.type,
      stepTargetWatts: resolvedTarget(step, ftpWatts),
      stepRemainingSec: Math.max(0, Math.ceil(endSec - elapsedSec)),
      elapsedSec: Math.floor(elapsedSec),
      totalSec,
      targetChanged,
    }
  }

  /** Consume the targetChanged flag after the UI applies ERG. */
  clearTargetChanged(): void {
    this.state.targetChanged = false
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
      workout: flat,
      freeRide: false,
      ftpWatts,
      status: 'running',
      stepIndex: 0,
      elapsedSec: 0,
      segmentStartedAtMs: nowMs,
      elapsedAtSegmentStart: 0,
      targetChanged: true,
    }
  }

  startFreeRide(nowMs: number): void {
    this.state = {
      workout: null,
      freeRide: true,
      ftpWatts: null,
      status: 'running',
      stepIndex: 0,
      elapsedSec: 0,
      segmentStartedAtMs: nowMs,
      elapsedAtSegmentStart: 0,
      targetChanged: false,
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
  }

  skip(nowMs: number): void {
    if (this.state.status !== 'running' && this.state.status !== 'paused') return
    if (this.state.freeRide || !this.state.workout) return
    this.syncElapsed(nowMs)
    const next = this.state.stepIndex + 1
    if (next >= this.state.workout.steps.length) {
      this.state.elapsedSec = totalDuration(this.state.workout.steps)
      this.state.status = 'completed'
      this.state.targetChanged = false
      return
    }
    const { startSec } = stepBounds(this.state.workout.steps, next)
    this.state.stepIndex = next
    this.state.elapsedSec = startSec
    this.state.elapsedAtSegmentStart = startSec
    this.state.segmentStartedAtMs = nowMs
    this.state.status = 'running'
    this.state.targetChanged = true
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
        this.state.stepIndex = workout.steps.length - 1
        this.state.elapsedSec = totalDuration(workout.steps)
        this.state.status = 'completed'
        this.state.targetChanged = false
        return
      }
      this.state.stepIndex = next
      this.state.targetChanged = true
      this.state.elapsedAtSegmentStart = this.state.elapsedSec
      this.state.segmentStartedAtMs = nowMs
    }
  }
}
