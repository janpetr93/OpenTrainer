import type { WorkoutItem, WorkoutStep } from './types.js'

/** Flatten Workout Repeats into the steps the runner and Power Profile play. */
export function expandWorkoutItems(items: readonly WorkoutItem[]): WorkoutStep[] {
  const out: WorkoutStep[] = []
  for (const item of items) {
    if (item.type === 'repeat') {
      for (let n = 0; n < item.count; n++) {
        for (const step of item.steps) {
          out.push({ ...step })
        }
      }
    } else {
      out.push({ ...item })
    }
  }
  return out
}

export function workoutDurationSec(items: readonly WorkoutItem[]): number {
  return expandWorkoutItems(items).reduce((sum, step) => sum + step.durationSec, 0)
}
