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
        }),
      })
      expect(res.status).toBe(201)
      const body = (await res.json()) as {
        activity: {
          id: string
          achievedPowerProfile: Array<{
            tSec: number
            watts: number
            hrBpm?: number
            cadenceRpm?: number
          }>
        }
      }
      expect(body.activity.id).toBeTruthy()
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
})
