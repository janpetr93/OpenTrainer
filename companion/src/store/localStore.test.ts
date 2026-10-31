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

  it('stores a Workout Repeat compactly and expands it on the planned Power Profile', async () => {
    await store.setFtp(200)
    const workout = await store.createWorkout({
      name: '30/15',
      steps: [
        { type: 'warmup', durationSec: 60, targetWatts: null, percentFtp: 50, zone: null },
        {
          type: 'repeat',
          count: 3,
          steps: [
            { type: 'steady', durationSec: 30, targetWatts: null, percentFtp: 120, zone: null },
            { type: 'recovery', durationSec: 15, targetWatts: null, percentFtp: 60, zone: null },
          ],
        },
      ],
    })

    expect(workout.steps).toHaveLength(2)
    expect(workout.steps[1]).toMatchObject({ type: 'repeat', count: 3 })
    const end = workout.plannedPowerProfile.at(-1)
    expect(end?.tSec).toBe(60 + 3 * 45)
    const loaded = await store.getWorkout(workout.id)
    expect(loaded?.steps[1]).toMatchObject({ type: 'repeat', count: 3 })
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

  it('createScheduledRide stores optional Session Purpose', async () => {
    const workout = await store.createWorkout({
      name: 'Threshold builder',
      steps: sampleSteps,
    })
    const withPurpose = await store.createScheduledRide({
      workoutId: workout.id,
      startsAt: '2026-10-12T07:00:00.000Z',
      purpose: 'Raise lactate threshold',
    })
    expect(withPurpose.purpose).toBe('Raise lactate threshold')
    expect(withPurpose.status).toBe('planned')
    expect(typeof withPurpose.missed).toBe('boolean')

    const without = await store.createScheduledRide({
      workoutId: workout.id,
      startsAt: '2026-10-13T07:00:00.000Z',
    })
    expect(without.purpose).toBeNull()
  })

  it('saveActivity with scheduledRideId marks the ride completed', async () => {
    const workout = await store.createWorkout({
      name: 'Complete me',
      steps: sampleSteps,
    })
    const ride = await store.createScheduledRide({
      workoutId: workout.id,
      startsAt: '2026-10-12T07:00:00.000Z',
      purpose: 'Test',
    })
    const activity = await store.saveActivity({
      startedAt: '2026-10-12T07:05:00.000Z',
      durationSec: 60,
      averagePowerWatts: 200,
      maxPowerWatts: 200,
      achievedPowerProfile: Array.from({ length: 60 }, (_, tSec) => ({
        tSec,
        watts: 200,
      })),
      plannedPowerProfile: null,
      workoutId: workout.id,
      scheduledRideId: ride.id,
      purpose: 'Test',
    })
    expect(activity.scheduledRideId).toBe(ride.id)
    const updated = await store.getScheduledRide(ride.id)
    expect(updated?.status).toBe('completed')
    expect(updated?.activityId).toBe(activity.id)
  })

  it('skipScheduledRide and rescheduleScheduledRide update status', async () => {
    const workout = await store.createWorkout({
      name: 'Skip me',
      steps: sampleSteps,
    })
    const ride = await store.createScheduledRide({
      workoutId: workout.id,
      startsAt: '2026-10-12T07:00:00.000Z',
    })
    const skipped = await store.skipScheduledRide(ride.id, 'Travel day')
    expect(skipped.status).toBe('skipped')
    expect(skipped.skipReason).toBe('Travel day')
    expect(skipped.missed).toBe(false)

    const moved = await store.rescheduleScheduledRide(
      ride.id,
      '2099-01-01T08:00:00.000Z',
    )
    expect(moved.status).toBe('planned')
    expect(moved.skipReason).toBeNull()
    expect(moved.startsAt).toBe('2099-01-01T08:00:00.000Z')
    expect(moved.missed).toBe(false)
  })

  it('saveActivity stores optional Session Purpose', async () => {
    const activity = await store.saveActivity({
      startedAt: '2026-10-12T07:05:00.000Z',
      durationSec: 600,
      averagePowerWatts: 200,
      maxPowerWatts: 220,
      achievedPowerProfile: [
        { tSec: 0, watts: 180 },
        { tSec: 600, watts: 200 },
      ],
      plannedPowerProfile: null,
      workoutId: null,
      purpose: 'Improve endurance',
    })
    expect(activity.purpose).toBe('Improve endurance')
    const listed = await store.listActivities({ pastDays: 30 })
    expect(listed[0]?.purpose).toBe('Improve endurance')
  })

  it('saveActivity computes Session Load and Adherence when FTP is set', async () => {
    await store.setFtp(200)
    const achieved = Array.from({ length: 600 }, (_, tSec) => ({
      tSec,
      watts: 200,
    }))
    const planned = Array.from({ length: 600 }, (_, tSec) => ({
      tSec,
      watts: 200,
    }))
    const activity = await store.saveActivity({
      startedAt: '2026-10-12T07:05:00.000Z',
      durationSec: 600,
      averagePowerWatts: 200,
      maxPowerWatts: 200,
      achievedPowerProfile: achieved,
      plannedPowerProfile: planned,
      workoutId: null,
      purpose: null,
    })
    expect(activity.sessionLoad?.normalizedPowerWatts).toBe(200)
    expect(activity.sessionLoad?.intensityFactor).toBe(1)
    expect(activity.sessionAdherence).toEqual({
      completionRatio: 1,
      targetAdherence: 1,
    })
    expect(activity.averageAlignmentDeltaWatts).toBeNull()
  })

  it('saveActivity stores Average Alignment Delta from paired meter samples', async () => {
    const activity = await store.saveActivity({
      startedAt: '2026-10-12T08:00:00.000Z',
      durationSec: 3,
      averagePowerWatts: 200,
      maxPowerWatts: 220,
      achievedPowerProfile: [
        { tSec: 0, watts: 200, meterWatts: 210 },
        { tSec: 1, watts: 200 },
        { tSec: 2, watts: 220, meterWatts: 230 },
      ],
      plannedPowerProfile: null,
      workoutId: null,
    })
    expect(activity.averageAlignmentDeltaWatts).toBe(10)
  })

  it('saveActivity stores Average Alignment Delta for meter-primary trainerWatts', async () => {
    const activity = await store.saveActivity({
      startedAt: '2026-10-12T09:00:00.000Z',
      durationSec: 2,
      averagePowerWatts: 121,
      maxPowerWatts: 122,
      achievedPowerProfile: [
        { tSec: 0, watts: 122, trainerWatts: 145 },
        { tSec: 1, watts: 120, trainerWatts: 144 },
      ],
      plannedPowerProfile: null,
      workoutId: null,
      primaryPowerSource: 'meter',
    })
    expect(activity.averageAlignmentDeltaWatts).toBe(-23)
    expect(activity.primaryPowerSource).toBe('meter')
  })

  it('getErgCalibration defaults and saveErgCalibration persists', async () => {
    const initial = await store.getErgCalibration()
    expect(initial.scale).toBe(1)
    expect(initial.offsetWatts).toBe(0)
    const saved = await store.saveErgCalibration({
      scale: 0.85,
      offsetWatts: 2,
    })
    expect(saved.scale).toBe(0.85)
    expect(saved.offsetWatts).toBe(2)
    expect(await store.getErgCalibration()).toEqual(saved)
  })

  it('backfillActivityMetrics adds Average Alignment Delta to older Activities', async () => {
    const { writeFile, mkdir } = await import('node:fs/promises')
    const activitiesDir = join(root, 'activities')
    await mkdir(activitiesDir, { recursive: true })
    const id = 'legacy-align-1'
    await writeFile(
      join(activitiesDir, `${id}.json`),
      JSON.stringify({
        schemaVersion: 1,
        id,
        startedAt: '2026-10-01T10:00:00.000Z',
        durationSec: 2,
        averagePowerWatts: 200,
        maxPowerWatts: 200,
        achievedPowerProfile: [
          { tSec: 0, watts: 200, meterWatts: 208 },
          { tSec: 1, watts: 200, meterWatts: 212 },
        ],
        plannedPowerProfile: null,
        workoutId: null,
        scheduledRideId: null,
        purpose: null,
        sessionLoad: null,
        sessionAdherence: null,
        createdAt: '2026-10-01T10:00:02.000Z',
      }),
    )

    const updated = await store.backfillActivityMetrics()
    expect(updated).toBe(1)
    const activity = await store.getActivity(id)
    expect(activity?.averageAlignmentDeltaWatts).toBe(10)
  })

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

  it('getRiderProfile returns null Training Intent when unset', async () => {
    const profile = await store.getRiderProfile()
    expect(profile.intent).toBeNull()
    expect(profile.ftpWatts).toBeNull()
  })

  it('setTrainingIntent persists goal/horizon/note/constraints and setFtp keeps it', async () => {
    const withIntent = await store.setTrainingIntent({
      goal: 'Raise FTP',
      horizon: 'May gran fondo',
      note: 'Deload through Oct 20',
      maxHardDaysPerWeek: 2,
      preferredLongRideWeekday: 6,
      constraintsNote: 'No early mornings',
    })
    expect(withIntent.intent).toEqual({
      goal: 'Raise FTP',
      horizon: 'May gran fondo',
      note: 'Deload through Oct 20',
      maxHardDaysPerWeek: 2,
      preferredLongRideWeekday: 6,
      constraintsNote: 'No early mornings',
    })

    const afterFtp = await store.setFtp(250)
    expect(afterFtp.ftpWatts).toBe(250)
    expect(afterFtp.intent).toEqual(withIntent.intent)

    const cleared = await store.setTrainingIntent(null)
    expect(cleared.intent).toBeNull()
    expect(cleared.ftpWatts).toBe(250)
  })

  it('saveActivity auto-recomputes Mean Maximal Power', async () => {
    expect(await store.getMmpCache()).toBeNull()

    const watts = Array.from({ length: 60 }, () => 200)
    await store.saveActivity({
      startedAt: '2026-10-01T10:00:00.000Z',
      durationSec: 59,
      averagePowerWatts: 200,
      maxPowerWatts: 200,
      achievedPowerProfile: watts.map((w, tSec) => ({ tSec, watts: w })),
      plannedPowerProfile: null,
      workoutId: null,
    })

    const cache = await store.getMmpCache()
    expect(cache).not.toBeNull()
    expect(cache!.points.find((p) => p.durationSec === 60)?.watts).toBe(200)
    expect(await store.isMmpStale(cache)).toBe(false)

    await store.saveActivity({
      startedAt: '2026-10-02T10:00:00.000Z',
      durationSec: 10,
      averagePowerWatts: 100,
      maxPowerWatts: 100,
      achievedPowerProfile: Array.from({ length: 11 }, (_, tSec) => ({
        tSec,
        watts: 100,
      })),
      plannedPowerProfile: null,
      workoutId: null,
    })
    const after = await store.getMmpCache()
    expect(after).not.toBeNull()
    expect(await store.isMmpStale(after)).toBe(false)
    expect(after!.activityCount).toBe(2)
  })
})
