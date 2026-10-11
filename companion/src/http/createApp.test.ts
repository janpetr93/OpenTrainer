import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalStore } from '../store/localStore.js'
import { createRequestHandler } from './createApp.js'

async function withServer(
  store: LocalStore,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const handler = createRequestHandler(store)
  const server = createServer((req, res) => {
    void handler(req, res)
  })
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind test server')
  }
  try {
    await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()))
    })
  }
}

describe('HTTP API', () => {
  let root: string
  let store: LocalStore

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'd100-http-'))
    store = new LocalStore(root)
    await store.ensureReady()
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('POST /api/workouts creates a Workout and GET lists it', async () => {
    await withServer(store, async (baseUrl) => {
      const created = await fetch(`${baseUrl}/api/workouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Easy spin',
          steps: [{ type: 'steady', durationSec: 600, targetWatts: 140, percentFtp: null, zone: null }],
        }),
      })
      expect(created.status).toBe(201)
      const createdBody = (await created.json()) as {
        workout: { id: string; plannedPowerProfile: unknown[] }
      }
      expect(createdBody.workout.plannedPowerProfile.length).toBeGreaterThan(0)

      const listed = await fetch(`${baseUrl}/api/workouts`)
      const listedBody = (await listed.json()) as { workouts: { id: string }[] }
      expect(listedBody.workouts.map((w) => w.id)).toContain(createdBody.workout.id)
    })
  })

  it('GET /api/activities returns empty list by default', async () => {
    await withServer(store, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/activities?pastDays=14`)
      expect(res.status).toBe(200)
      const body = (await res.json()) as { activities: unknown[] }
      expect(body.activities).toEqual([])
    })
  })

  it('GET/PUT /api/erg-calibration reads and persists ERG Calibration', async () => {
    await withServer(store, async (baseUrl) => {
      const getRes = await fetch(`${baseUrl}/api/erg-calibration`)
      expect(getRes.status).toBe(200)
      const getBody = (await getRes.json()) as {
        calibration: { scale: number; offsetWatts: number }
      }
      expect(getBody.calibration.scale).toBe(1)
      expect(getBody.calibration.offsetWatts).toBe(0)

      const putRes = await fetch(`${baseUrl}/api/erg-calibration`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scale: 0.85, offsetWatts: -2 }),
      })
      expect(putRes.status).toBe(200)
      const putBody = (await putRes.json()) as {
        calibration: { scale: number; offsetWatts: number }
      }
      expect(putBody.calibration.scale).toBe(0.85)
      expect(putBody.calibration.offsetWatts).toBe(-2)

      const again = await fetch(`${baseUrl}/api/erg-calibration`)
      const againBody = (await again.json()) as {
        calibration: { scale: number; offsetWatts: number }
      }
      expect(againBody.calibration.scale).toBe(0.85)
    })
  })

  it('GET /api/profile returns Rider Profile; PUT profile routes are not exposed', async () => {
    await store.setFtp(240)
    await store.setTrainingIntent({
      goal: 'Climbing',
      horizon: 'summer',
      note: null,
    })
    await withServer(store, async (baseUrl) => {
      const getRes = await fetch(`${baseUrl}/api/profile`)
      expect(getRes.status).toBe(200)
      const getBody = (await getRes.json()) as {
        profile: {
          ftpWatts: number | null
          intent: { goal: string; horizon: string | null; note: string | null } | null
        }
      }
      expect(getBody.profile.ftpWatts).toBe(240)
      expect(getBody.profile.intent).toEqual({
        goal: 'Climbing',
        horizon: 'summer',
        note: null,
        maxHardDaysPerWeek: null,
        preferredLongRideWeekday: null,
        constraintsNote: null,
      })

      const putFtp = await fetch(`${baseUrl}/api/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ftpWatts: 250 }),
      })
      expect(putFtp.status).toBe(404)

      const putIntent = await fetch(`${baseUrl}/api/profile/intent`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: null }),
      })
      expect(putIntent.status).toBe(404)

      const after = await store.getRiderProfile()
      expect(after.ftpWatts).toBe(240)
      expect(after.intent?.goal).toBe('Climbing')
    })
  })

  it('POST /api/activities saves an Activity', async () => {
    await withServer(store, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startedAt: new Date().toISOString(),
          durationSec: 60,
          averagePowerWatts: 150,
          maxPowerWatts: 180,
          achievedPowerProfile: [
            { tSec: 0, watts: 140, hrBpm: 140, cadenceRpm: 85 },
            { tSec: 60, watts: 160, hrBpm: 155 },
          ],
          plannedPowerProfile: null,
          workoutId: null,
          purpose: 'Improve endurance',
        }),
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as {
        activity: {
          id: string
          purpose: string | null
          achievedPowerProfile: Array<{
            tSec: number
            watts: number
            hrBpm?: number
            cadenceRpm?: number
          }>
        }
      }
      expect(body.activity.id).toBeTruthy()
      expect(body.activity.purpose).toBe('Improve endurance')
      expect(body.activity.achievedPowerProfile[0]).toMatchObject({
        tSec: 0,
        watts: 140,
        hrBpm: 140,
        cadenceRpm: 85,
      })
      expect(body.activity.achievedPowerProfile[1]).toMatchObject({
        tSec: 60,
        watts: 160,
        hrBpm: 155,
      })
    })
  })

  it('POST /api/scheduled-rides accepts Session Purpose', async () => {
    const workout = await store.createWorkout({
      name: 'Threshold',
      steps: [
        {
          type: 'steady',
          durationSec: 600,
          targetWatts: 220,
          percentFtp: null,
          zone: null,
        },
      ],
    })
    await withServer(store, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/scheduled-rides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workoutId: workout.id,
          startsAt: '2026-10-12T07:00:00.000Z',
          purpose: 'Raise lactate threshold',
        }),
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as {
        scheduledRide: { purpose: string | null; workoutId: string }
      }
      expect(body.scheduledRide.workoutId).toBe(workout.id)
      expect(body.scheduledRide.purpose).toBe('Raise lactate threshold')
    })
  })

  it('GET /api/strava/status reports unconfigured by default', async () => {
    await withServer(store, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/strava/status`)
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        configured: boolean
        linked: boolean
      }
      expect(body.configured).toBe(false)
      expect(body.linked).toBe(false)
    })
  })

  it('GET /api/mmp is empty until an Activity is saved; stays fresh after further saves', async () => {
    await store.setFtp(250)
    await withServer(store, async (baseUrl) => {
      const empty = await fetch(`${baseUrl}/api/mmp`)
      expect(empty.status).toBe(200)
      const emptyBody = (await empty.json()) as {
        mmp: { points: unknown[]; stale: boolean; computedAt: string | null }
      }
      expect(emptyBody.mmp.points).toEqual([])
      expect(emptyBody.mmp.stale).toBe(true)
      expect(emptyBody.mmp.computedAt).toBeNull()

      const watts = Array.from({ length: 1200 }, () => 300)
      await store.saveActivity({
        startedAt: '2026-10-01T10:00:00.000Z',
        durationSec: 1199,
        averagePowerWatts: 300,
        maxPowerWatts: 300,
        achievedPowerProfile: watts.map((w, tSec) => ({ tSec, watts: w })),
        plannedPowerProfile: null,
        workoutId: null,
      })

      const afterSave = await fetch(`${baseUrl}/api/mmp`)
      expect(afterSave.status).toBe(200)
      const body = (await afterSave.json()) as {
        mmp: {
          stale: boolean
          estimatedFtpWatts: number | null
          setFtpWatts: number | null
          estimatedFtpDeltaWatts: number | null
          points: Array<{ durationSec: number; watts: number | null; percentFtp: number | null }>
        }
      }
      expect(body.mmp.stale).toBe(false)
      expect(body.mmp.setFtpWatts).toBe(250)
      expect(body.mmp.estimatedFtpWatts).toBe(285)
      expect(body.mmp.estimatedFtpDeltaWatts).toBe(35)
      expect(body.mmp.points.find((p) => p.durationSec === 1200)?.watts).toBe(300)
      expect(body.mmp.points.find((p) => p.durationSec === 1200)?.percentFtp).toBe(120)

      await store.saveActivity({
        startedAt: '2026-10-02T10:00:00.000Z',
        durationSec: 5,
        averagePowerWatts: 100,
        maxPowerWatts: 100,
        achievedPowerProfile: Array.from({ length: 6 }, (_, tSec) => ({
          tSec,
          watts: 100,
        })),
        plannedPowerProfile: null,
        workoutId: null,
      })

      const freshRes = await fetch(`${baseUrl}/api/mmp`)
      const freshBody = (await freshRes.json()) as { mmp: { stale: boolean } }
      expect(freshBody.mmp.stale).toBe(false)
    })
  })
})
