import { describe, expect, it } from 'vitest'
import {
  hydrateScheduledRide,
  isMissedScheduledRide,
  toScheduledRideView,
} from './scheduledRideOutcome.js'
import type { ScheduledRide } from './types.js'

const base: ScheduledRide = {
  schemaVersion: 1,
  id: 'r1',
  workoutId: 'w1',
  startsAt: '2026-10-01T10:00:00.000Z',
  purpose: null,
  status: 'planned',
  activityId: null,
  skipReason: null,
  createdAt: '2026-09-01T10:00:00.000Z',
}

describe('scheduledRideOutcome', () => {
  it('marks past planned rides as missed', () => {
    const now = Date.parse('2026-10-02T00:00:00.000Z')
    expect(isMissedScheduledRide(base, now)).toBe(true)
    expect(toScheduledRideView(base, now).missed).toBe(true)
  })

  it('does not mark future planned or completed/skipped as missed', () => {
    const now = Date.parse('2026-09-15T00:00:00.000Z')
    expect(isMissedScheduledRide(base, now)).toBe(false)
    expect(
      isMissedScheduledRide({ ...base, status: 'completed' }, Date.now()),
    ).toBe(false)
    expect(
      isMissedScheduledRide({ ...base, status: 'skipped' }, Date.now()),
    ).toBe(false)
  })

  it('hydrates legacy rides without status fields', () => {
    const legacy = {
      schemaVersion: 1 as const,
      id: 'r1',
      workoutId: 'w1',
      startsAt: '2026-10-01T10:00:00.000Z',
      purpose: null,
      createdAt: '2026-09-01T10:00:00.000Z',
    }
    expect(hydrateScheduledRide(legacy as ScheduledRide)).toMatchObject({
      status: 'planned',
      activityId: null,
      skipReason: null,
    })
  })
})
