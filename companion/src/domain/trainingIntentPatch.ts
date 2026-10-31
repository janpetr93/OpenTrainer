import type { TrainingIntent } from './types.js'

/** Fields the caller actually sent. Omitted keys keep the current Intent value. */
export type TrainingIntentPatch = {
  goal?: string
  horizon?: string | null
  note?: string | null
  maxHardDaysPerWeek?: number | null
  preferredLongRideWeekday?: number | null
  constraintsNote?: string | null
}

function kept<T>(patchValue: T | undefined, current: T | null): T | null {
  if (patchValue === undefined) return current
  return patchValue
}

/**
 * Build the next Training Intent. Omitted patch fields keep current values.
 * An explicit null clears that field. goal is required only when Intent is unset.
 */
export function mergeTrainingIntent(
  current: TrainingIntent | null,
  patch: TrainingIntentPatch,
): TrainingIntent {
  const goalSource = patch.goal !== undefined ? patch.goal : current?.goal
  const goal = goalSource?.trim() ?? ''
  if (!goal) {
    throw new Error('Training Intent goal is required when Intent is unset')
  }
  return {
    goal,
    horizon: kept(patch.horizon, current?.horizon ?? null),
    note: kept(patch.note, current?.note ?? null),
    maxHardDaysPerWeek: kept(
      patch.maxHardDaysPerWeek,
      current?.maxHardDaysPerWeek ?? null,
    ),
    preferredLongRideWeekday: kept(
      patch.preferredLongRideWeekday,
      current?.preferredLongRideWeekday ?? null,
    ),
    constraintsNote: kept(
      patch.constraintsNote,
      current?.constraintsNote ?? null,
    ),
  }
}
