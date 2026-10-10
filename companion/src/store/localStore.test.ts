import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalStore } from './localStore.js'

describe('LocalStore', () => {
  let root: string
  let store: LocalStore

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'd100-store-'))
    store = new LocalStore(root)
    await store.ensureReady()
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('createWorkout persists a Workout with planned Power Profile', async () => {
    const workout = await store.createWorkout({
      name: 'Sweet spot 2x10',
      steps: [
        { type: 'warmup', durationSec: 300, targetWatts: 120, percentFtp: null, zone: null },
        { type: 'steady', durationSec: 600, targetWatts: 250, percentFtp: null, zone: null },
        { type: 'recovery', durationSec: 300, targetWatts: 100, percentFtp: null, zone: null },
        { type: 'steady', durationSec: 600, targetWatts: 250, percentFtp: null, zone: null },
        { type: 'cooldown', durationSec: 300, targetWatts: 100, percentFtp: null, zone: null },
      ],
    })

    expect(workout.id).toBeTruthy()
    expect(workout.name).toBe('Sweet spot 2x10')
    expect(workout.plannedPowerProfile.length).toBeGreaterThan(0)
    expect(workout.plannedPowerProfile[0]).toEqual({ tSec: 0, watts: 120 })

    const listed = await store.listWorkouts()
    expect(listed).toHaveLength(1)
    expect(listed[0]?.id).toBe(workout.id)
  })

  it('listActivities returns empty when none exist', async () => {
    const activities = await store.listActivities({ pastDays: 14 })
    expect(activities).toEqual([])
  })

  it('listActivities filters by pastDays using startedAt', async () => {
    const now = Date.now()
    await store.saveActivity({
      startedAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
      durationSec: 1800,
      averagePowerWatts: 200,
      maxPowerWatts: 320,
      achievedPowerProfile: [
        { tSec: 0, watts: 180 },
        { tSec: 1800, watts: 220 },
      ],
      plannedPowerProfile: null,
      workoutId: null,
    })
    await store.saveActivity({
      startedAt: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
      durationSec: 900,
      averagePowerWatts: 150,
      maxPowerWatts: 200,
      achievedPowerProfile: [
        { tSec: 0, watts: 150 },
        { tSec: 900, watts: 150 },
      ],
      plannedPowerProfile: null,
      workoutId: null,
    })

    const recent = await store.listActivities({ pastDays: 14 })
    expect(recent).toHaveLength(1)
    expect(recent[0]?.averagePowerWatts).toBe(200)
    expect(recent[0]?.plannedPowerProfile).toBeNull()
  })

  const sampleSteps = [
    {
      type: 'steady' as const,
      durationSec: 600,
      targetWatts: 200,
      percentFtp: null,
      zone: null,
    },
  ]

  it('clearScheduledRides deletes orphan Workouts with no remaining rides or Activities', async () => {
    const workout = await store.createWorkout({
      name: 'Week plan intervals',
      steps: sampleSteps,
    })
    const startsAt = '2026-10-12T07:00:00.000Z'
    await store.createScheduledRide({ workoutId: workout.id, startsAt })

    const deleted = await store.clearScheduledRides({
      since: '2026-10-12T00:00:00.000Z',
      until: '2026-10-13T00:00:00.000Z',
    })

    expect(deleted).toBe(1)
    expect(await store.getWorkout(workout.id)).toBeNull()
    expect(await store.listWorkouts()).toHaveLength(0)
  })

  it('clearScheduledRides keeps a Workout still referenced by an Activity', async () => {
    const workout = await store.createWorkout({
      name: 'Ridden once',
      steps: sampleSteps,
    })
    await store.createScheduledRide({
      workoutId: workout.id,
      startsAt: '2026-10-12T07:00:00.000Z',
    })
    await store.saveActivity({
      startedAt: '2026-10-12T07:05:00.000Z',
      durationSec: 600,
      averagePowerWatts: 200,
      maxPowerWatts: 220,
      achievedPowerProfile: [
        { tSec: 0, watts: 180 },
        { tSec: 600, watts: 200 },
      ],
      plannedPowerProfile: [{ tSec: 0, watts: 200 }],
      workoutId: workout.id,
    })

    await store.clearScheduledRides({
      since: '2026-10-12T00:00:00.000Z',
      until: '2026-10-13T00:00:00.000Z',
    })

    expect(await store.getWorkout(workout.id)).not.toBeNull()
  })

  it('deleteScheduledRide deletes an orphan Workout', async () => {
    const workout = await store.createWorkout({
      name: 'Single ride',
      steps: sampleSteps,
    })
    const ride = await store.createScheduledRide({
      workoutId: workout.id,
      startsAt: '2026-10-14T07:00:00.000Z',
    })

    expect(await store.deleteScheduledRide(ride.id)).toBe(true)
    expect(await store.getWorkout(workout.id)).toBeNull()
  })

  it('deleteScheduledRide keeps a Workout still referenced by another Scheduled Ride', async () => {
    const workout = await store.createWorkout({
      name: 'Twice scheduled',
      steps: sampleSteps,
    })
    const first = await store.createScheduledRide({
      workoutId: workout.id,
      startsAt: '2026-10-14T07:00:00.000Z',
    })
    await store.createScheduledRide({
      workoutId: workout.id,
      startsAt: '2026-10-16T07:00:00.000Z',
    })

    expect(await store.deleteScheduledRide(first.id)).toBe(true)
    expect(await store.getWorkout(workout.id)).not.toBeNull()
  })
})
