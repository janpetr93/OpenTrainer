import { describe, expect, it } from 'vitest'
import {
  applyCompleteBlocker,
  applySkipBlocker,
  isMissedBlocker,
  toBlockerView,
} from './blockerOutcome.js'
import type { Blocker } from './types.js'

function base(overrides: Partial<Blocker> = {}): Blocker {
  return {
    schemaVersion: 1,
    id: 'b1',
    kind: 'run',
    startsAt: '2026-11-10T07:00:00.000Z',
    allDay: false,
    durationMin: 45,
    label: 'easy run',
    status: 'planned',
    trainingStressScore: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('blockerOutcome', () => {
  it('marks past planned sport Blockers as missed; social never missed', () => {
    const now = Date.parse('2026-11-12T12:00:00.000Z')
    expect(isMissedBlocker(base(), now)).toBe(true)
    expect(isMissedBlocker(base({ kind: 'social' }), now)).toBe(false)
    expect(
      isMissedBlocker(base({ status: 'completed', trainingStressScore: 40 }), now),
    ).toBe(false)
    expect(
      toBlockerView(base({ startsAt: '2026-11-20T07:00:00.000Z' }), now).missed,
    ).toBe(false)
  })

  it('completes a sport Blocker with External Load and optional fact alignment', () => {
    const completed = applyCompleteBlocker(base(), {
      trainingStressScore: 52,
      durationMin: 55,
      label: 'Garmin easy 55',
      startsAt: '2026-11-10T06:30:00.000Z',
    })
    expect(completed.status).toBe('completed')
    expect(completed.trainingStressScore).toBe(52)
    expect(completed.durationMin).toBe(55)
    expect(completed.label).toBe('Garmin easy 55')
    expect(completed.startsAt).toBe('2026-11-10T06:30:00.000Z')
  })

  it('rejects completing a social Blocker or non-positive TSS', () => {
    expect(() =>
      applyCompleteBlocker(base({ kind: 'social' }), { trainingStressScore: 40 }),
    ).toThrow(/social/i)
    expect(() =>
      applyCompleteBlocker(base(), { trainingStressScore: 0 }),
    ).toThrow(/trainingStressScore/i)
  })

  it('skips a sport Blocker and clears External Load', () => {
    const skipped = applySkipBlocker(
      base({ status: 'completed', trainingStressScore: 40 }),
    )
    expect(skipped.status).toBe('skipped')
    expect(skipped.trainingStressScore).toBeNull()
  })
})
