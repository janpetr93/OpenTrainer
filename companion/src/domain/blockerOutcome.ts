import {
  blockerWindow,
  isSportBlocker,
  normalizeBlockerLabel,
} from './blocker.js'
import type {
  Blocker,
  CompleteBlockerInput,
  SkipBlockerInput,
} from './types.js'

export type BlockerView = Blocker & { missed: boolean }

export function isMissedBlocker(
  blocker: Pick<Blocker, 'kind' | 'status' | 'startsAt'>,
  nowMs: number = Date.now(),
): boolean {
  if (!isSportBlocker(blocker.kind)) return false
  if (blocker.status !== 'planned') return false
  const starts = Date.parse(blocker.startsAt)
  if (Number.isNaN(starts)) return false
  return starts < nowMs
}

export function toBlockerView(
  blocker: Blocker,
  nowMs: number = Date.now(),
): BlockerView {
  return {
    ...blocker,
    missed: isMissedBlocker(blocker, nowMs),
  }
}

export function applyCompleteBlocker(
  blocker: Blocker,
  input: CompleteBlockerInput & { trainingStressScore: number },
): Blocker {
  if (!isSportBlocker(blocker.kind)) {
    throw new Error('Cannot complete a social Blocker')
  }
  if (
    typeof input.trainingStressScore !== 'number' ||
    !Number.isFinite(input.trainingStressScore) ||
    input.trainingStressScore <= 0
  ) {
    throw new Error('trainingStressScore must be a positive number')
  }

  const startsAt =
    input.startsAt !== undefined
      ? new Date(Date.parse(input.startsAt)).toISOString()
      : blocker.startsAt
  if (Number.isNaN(Date.parse(startsAt))) {
    throw new Error('startsAt must be a valid ISO datetime')
  }

  const allDay = input.allDay ?? blocker.allDay
  const durationMin =
    input.allDay === true
      ? null
      : input.durationMin !== undefined
        ? input.durationMin
        : blocker.durationMin
  const label =
    input.label !== undefined
      ? normalizeBlockerLabel(input.label)
      : blocker.label

  const next: Blocker = {
    ...blocker,
    startsAt,
    allDay,
    durationMin,
    label,
    status: 'completed',
    trainingStressScore: input.trainingStressScore,
  }
  blockerWindow(next)
  return next
}

export function applySkipBlocker(
  blocker: Blocker,
  _input: SkipBlockerInput = {},
): Blocker {
  if (!isSportBlocker(blocker.kind)) {
    throw new Error('Cannot skip a social Blocker')
  }
  return {
    ...blocker,
    status: 'skipped',
    trainingStressScore: null,
  }
}
