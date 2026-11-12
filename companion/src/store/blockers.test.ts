import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalStore } from './localStore.js'

describe('LocalStore Blockers', () => {
  let root: string
  let store: LocalStore

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'd100-blocker-'))
    store = new LocalStore(root)
    await store.ensureReady()
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('creates and lists a timed Blocker in a range', async () => {
    const blocker = await store.createBlocker({
      kind: 'run',
      startsAt: '2026-11-17T06:00:00.000Z',
      durationMin: 50,
      label: ' easy 50 min ',
    })
    expect(blocker.kind).toBe('run')
    expect(blocker.allDay).toBe(false)
    expect(blocker.durationMin).toBe(50)
    expect(blocker.label).toBe('easy 50 min')

    const listed = await store.listBlockers({
      since: '2026-11-01T00:00:00.000Z',
      until: '2026-11-30T23:59:59.999Z',
    })
    expect(listed.map((item) => item.id)).toEqual([blocker.id])
  })

  it('stores an all-day Blocker without a duration', async () => {
    const blocker = await store.createBlocker({
      kind: 'social',
      startsAt: '2026-11-20T15:00:00.000Z',
      allDay: true,
      durationMin: 90,
      label: 'trip',
    })
    expect(blocker.allDay).toBe(true)
    expect(blocker.durationMin).toBeNull()
  })

  it('rejects a timed Blocker with no duration', async () => {
    await expect(
      store.createBlocker({
        kind: 'gym',
        startsAt: '2026-11-18T17:00:00.000Z',
      }),
    ).rejects.toThrow(/durationMin/)
  })

  it('updates, deletes, and clears Blockers without touching Scheduled Rides', async () => {
    const workout = await store.createWorkout({
      name: 'Easy spin',
      steps: [
        {
          type: 'steady',
          durationSec: 3600,
          targetWatts: 140,
          percentFtp: null,
          zone: null,
        },
      ],
    })
    const ride = await store.createScheduledRide({
      workoutId: workout.id,
      startsAt: '2026-11-17T17:00:00.000Z',
    })
    const run = await store.createBlocker({
      kind: 'run',
      startsAt: '2026-11-17T06:00:00.000Z',
      durationMin: 50,
    })
    const dinner = await store.createBlocker({
      kind: 'social',
      startsAt: '2026-11-18T18:00:00.000Z',
      durationMin: 120,
      label: 'dinner',
    })

    const updated = await store.updateBlocker(run.id, {
      label: 'easy 50 min',
      durationMin: 40,
    })
    expect(updated.label).toBe('easy 50 min')
    expect(updated.durationMin).toBe(40)
    expect(updated.allDay).toBe(false)

    const cleared = await store.clearBlockers({
      since: '2026-11-17T00:00:00.000Z',
      until: '2026-11-17T23:59:59.999Z',
    })
    expect(cleared).toBe(1)
    expect(await store.getBlocker(run.id)).toBeNull()
    expect((await store.getBlocker(dinner.id))?.label).toBe('dinner')
    expect(await store.listScheduledRides({})).toHaveLength(1)
    expect((await store.listScheduledRides({}))[0]?.id).toBe(ride.id)

    expect(await store.deleteBlocker(dinner.id)).toBe(true)
    expect(await store.listBlockers({})).toHaveLength(0)
  })

  it('completes a sport Blocker with External Load and recomputes Form', async () => {
    const run = await store.createBlocker({
      kind: 'run',
      startsAt: '2026-11-10T07:00:00.000Z',
      durationMin: 45,
      label: 'easy run',
    })
    expect(run.status).toBe('planned')
    expect(run.trainingStressScore).toBeNull()
    expect((await store.listBlockers({}))[0]?.missed).toBe(true)

    const completed = await store.completeBlocker(run.id, {
      trainingStressScore: 48,
      durationMin: 52,
      label: 'Garmin easy 52',
    })
    expect(completed.status).toBe('completed')
    expect(completed.trainingStressScore).toBe(48)
    expect(completed.durationMin).toBe(52)
    expect(completed.label).toBe('Garmin easy 52 · override')

    const form = await store.getFormCache()
    expect(form).not.toBeNull()
    expect(form!.historyDays).toBeGreaterThan(0)
    expect(form!.series.some((d) => d.trainingStressScore === 48)).toBe(true)
  })

  it('computes rTSS when Profile has Threshold Pace and avg pace is passed', async () => {
    await store.setPhysiology({ runThresholdPaceSecPerKm: 293 })
    const run = await store.createBlocker({
      kind: 'run',
      startsAt: '2026-10-17T09:00:00.000Z',
      durationMin: 50,
      label: 'Prague Running',
    })
    const completed = await store.completeBlocker(run.id, {
      durationMin: 50,
      averagePaceSecPerKm: 320,
      label: 'Prague Running',
    })
    expect(completed.trainingStressScore).toBe(69.9)
    expect(completed.label).toBe('Prague Running · rTSS')
  })

  it('creates an already-completed spontaneous sport Blocker', async () => {
    const blocker = await store.createBlocker({
      kind: 'gym',
      startsAt: '2026-11-11T18:00:00.000Z',
      durationMin: 40,
      status: 'completed',
      trainingStressScore: 35,
      label: 'legs',
    })
    expect(blocker.status).toBe('completed')
    expect(blocker.trainingStressScore).toBe(35)
    const form = await store.getFormCache()
    expect(form!.series.some((d) => d.trainingStressScore === 35)).toBe(true)
  })
})
