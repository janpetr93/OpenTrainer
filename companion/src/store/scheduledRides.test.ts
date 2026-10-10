import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalStore } from './localStore.js'

describe('LocalStore Scheduled Rides', () => {
  let root: string
  let store: LocalStore
  let workoutId: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'd100-sched-'))
    store = new LocalStore(root)
    await store.ensureReady()
    const workout = await store.createWorkout({
      name: 'Tempo',
      steps: [{ type: 'steady', durationSec: 600, targetWatts: 200, percentFtp: null, zone: null }],
    })
    workoutId = workout.id
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('creates and lists a Scheduled Ride', async () => {
    const scheduled = await store.createScheduledRide({
      workoutId,
      startsAt: '2026-10-15T07:00:00.000Z',
    })
    expect(scheduled.workoutId).toBe(workoutId)

    const listed = await store.listScheduledRides({
      since: '2026-10-01T00:00:00.000Z',
      until: '2026-10-31T23:59:59.999Z',
    })
    expect(listed).toHaveLength(1)
    expect(listed[0]?.id).toBe(scheduled.id)
  })

  it('rejects scheduling an unknown Workout', async () => {
    await expect(
      store.createScheduledRide({
        workoutId: 'missing',
        startsAt: '2026-10-15T07:00:00.000Z',
      }),
    ).rejects.toThrow(/workout/i)
  })

  it('deletes a Scheduled Ride', async () => {
    const scheduled = await store.createScheduledRide({
      workoutId,
      startsAt: '2026-10-20T08:00:00.000Z',
    })
    await store.deleteScheduledRide(scheduled.id)
    const listed = await store.listScheduledRides({})
    expect(listed).toHaveLength(0)
  })
})
