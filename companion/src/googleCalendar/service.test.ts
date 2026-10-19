import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalStore } from '../store/localStore.js'
import { GOOGLE_CALENDAR_SCOPE } from './client.js'
import { CalendarMirror } from './service.js'

const SCOPE = GOOGLE_CALENDAR_SCOPE

describe('CalendarMirror', () => {
  let root: string
  let store: LocalStore
  const now = new Date(2026, 9, 19, 15, 0, 0).getTime()

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'd100-gcal-'))
    store = new LocalStore(root)
    await store.ensureReady()
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('reports not configured when credentials are missing', async () => {
    const unconfigured = new CalendarMirror({
      store,
      config: null,
      companionOrigin: 'http://127.0.0.1:8787',
      webOrigin: 'http://127.0.0.1:5173',
      now: () => now,
    })
    await expect(unconfigured.getStatus()).resolves.toEqual({
      configured: false,
      linked: false,
      calendarId: null,
      lastError: null,
    })
  })

  it('copies planned rides from the start of today onto an OpenTrainer calendar', async () => {
    const calls: Array<{ url: string; method: string; body: Record<string, unknown> | null }> =
      []
    const fetchImpl = fakeGoogle(calls)
    const mirror = mirrorWith(store, fetchImpl, now)
    const today = await store.createWorkout({
      name: 'Upper Z2',
      steps: [
        {
          type: 'steady',
          durationSec: 90 * 60,
          targetWatts: 160,
          percentFtp: null,
          zone: null,
        },
      ],
    })
    const yesterdayWorkout = await store.createWorkout({
      name: 'Old missed',
      steps: [
        {
          type: 'steady',
          durationSec: 600,
          targetWatts: 100,
          percentFtp: null,
          zone: null,
        },
      ],
    })
    const doneWorkout = await store.createWorkout({
      name: 'Already ridden',
      steps: [
        {
          type: 'steady',
          durationSec: 600,
          targetWatts: 100,
          percentFtp: null,
          zone: null,
        },
      ],
    })
    const todayRide = await store.createScheduledRide({
      workoutId: today.id,
      startsAt: new Date(2026, 9, 19, 9, 0, 0).toISOString(),
      purpose: 'improve endurance',
    })
    await store.createScheduledRide({
      workoutId: yesterdayWorkout.id,
      startsAt: new Date(2026, 9, 18, 9, 0, 0).toISOString(),
      purpose: null,
    })
    const completed = await store.createScheduledRide({
      workoutId: doneWorkout.id,
      startsAt: new Date(2026, 9, 19, 7, 0, 0).toISOString(),
      purpose: null,
    })
    await store.markScheduledRideCompleted(completed.id, 'activity-1')

    const { url } = mirror.beginAuthorize()
    const state = new URL(url).searchParams.get('state')
    expect(new URL(url).searchParams.get('scope')).toBe(SCOPE)
    expect(new URL(url).searchParams.get('access_type')).toBe('offline')

    const redirect = await mirror.completeOAuth({
      code: 'auth-code',
      state,
      scope: SCOPE,
      error: null,
    })
    expect(redirect).toContain('googleCalendar=linked')

    const createdCalendar = calls.find(
      (call) => call.method === 'POST' && call.url.endsWith('/calendars'),
    )
    expect(createdCalendar?.body).toMatchObject({ summary: 'OpenTrainer' })

    const inserts = calls.filter(
      (call) => call.method === 'POST' && call.url.includes('/events'),
    )
    expect(inserts).toHaveLength(1)
    expect(inserts[0]?.body).toMatchObject({
      summary: 'Upper Z2',
      description: 'improve endurance',
      reminders: { useDefault: false },
    })
    const start = inserts[0]?.body?.start as { dateTime: string }
    const end = inserts[0]?.body?.end as { dateTime: string }
    expect(start.dateTime).toBe(todayRide.startsAt)
    expect(Date.parse(end.dateTime) - Date.parse(start.dateTime)).toBe(90 * 60 * 1000)

    const status = await mirror.getStatus()
    expect(status).toMatchObject({
      configured: true,
      linked: true,
      calendarId: 'cal-1',
      lastError: null,
    })
  })

  it('moves a rescheduled ride, removes a skip or delete, and leaves a completed ride', async () => {
    const calls: Array<{ url: string; method: string; body: Record<string, unknown> | null }> =
      []
    const fetchImpl = fakeGoogle(calls)
    const mirror = mirrorWith(store, fetchImpl, now)
    const workout = await store.createWorkout({
      name: 'Sweet spot',
      steps: [
        {
          type: 'steady',
          durationSec: 3600,
          targetWatts: 200,
          percentFtp: null,
          zone: null,
        },
      ],
    })
    const ride = await store.createScheduledRide({
      workoutId: workout.id,
      startsAt: new Date(2026, 9, 20, 18, 0, 0).toISOString(),
      purpose: 'raise lactate threshold',
    })
    await connect(mirror)

    const movedTo = new Date(2026, 9, 21, 18, 0, 0).toISOString()
    await store.rescheduleScheduledRide(ride.id, movedTo)
    await mirror.reconcile()
    const patch = calls.find((call) => call.method === 'PATCH')
    expect((patch?.body?.start as { dateTime: string }).dateTime).toBe(movedTo)

    await store.skipScheduledRide(ride.id, 'Travel day')
    await mirror.reconcile()
    expect(calls.some((call) => call.method === 'DELETE' && call.url.includes('/events/'))).toBe(
      true,
    )

    const other = await store.createScheduledRide({
      workoutId: workout.id,
      startsAt: new Date(2026, 9, 22, 18, 0, 0).toISOString(),
      purpose: null,
    })
    await mirror.reconcile()
    const beforeDelete = calls.filter((call) => call.method === 'DELETE').length
    await store.deleteScheduledRide(other.id)
    await mirror.reconcile()
    expect(calls.filter((call) => call.method === 'DELETE').length).toBeGreaterThan(beforeDelete)

    const finished = await store.createScheduledRide({
      workoutId: workout.id,
      startsAt: new Date(2026, 9, 19, 8, 0, 0).toISOString(),
      purpose: null,
    })
    await mirror.reconcile()
    const deletesBeforeComplete = calls.filter((call) => call.method === 'DELETE').length
    await store.markScheduledRideCompleted(finished.id, 'activity-9')
    await mirror.reconcile()
    expect(calls.filter((call) => call.method === 'DELETE').length).toBe(deletesBeforeComplete)
  })

  it('keeps the local ride when Google rejects the event, and unlink does not delete the calendar', async () => {
    const calls: Array<{ url: string; method: string; body: Record<string, unknown> | null }> =
      []
    const fetchImpl = fakeGoogle(calls, { failEvents: true })
    const mirror = mirrorWith(store, fetchImpl, now)
    const workout = await store.createWorkout({
      name: 'Recovery',
      steps: [
        {
          type: 'steady',
          durationSec: 1800,
          targetWatts: 100,
          percentFtp: null,
          zone: null,
        },
      ],
    })
    await store.createScheduledRide({
      workoutId: workout.id,
      startsAt: new Date(2026, 9, 19, 11, 0, 0).toISOString(),
      purpose: null,
    })
    const redirect = await connect(mirror)
    expect(redirect).toContain('googleCalendar=linked')
    expect((await store.listScheduledRides()).length).toBe(1)
    expect((await mirror.getStatus()).lastError).toBeTruthy()

    calls.length = 0
    await mirror.disconnect()
    expect(calls.some((call) => call.method === 'DELETE')).toBe(false)
    const status = await mirror.getStatus()
    expect(status.linked).toBe(false)
    expect(status.calendarId).toBe('cal-1')

    await connect(mirror)
    expect(
      calls.some((call) => call.method === 'POST' && call.url.endsWith('/calendars')),
    ).toBe(false)
    expect(
      calls.some((call) => call.method === 'GET' && call.url.includes('/calendars/cal-1')),
    ).toBe(true)
  })

  it('recreates a planned event Google no longer has', async () => {
    const calls: Array<{ url: string; method: string; body: Record<string, unknown> | null }> =
      []
    let missing = false
    const fetchImpl = fakeGoogle(calls, {
      onPatch: () => (missing ? 'missing' : 'updated'),
    })
    const mirror = mirrorWith(store, fetchImpl, now)
    const workout = await store.createWorkout({
      name: 'Tempo',
      steps: [
        {
          type: 'steady',
          durationSec: 1200,
          targetWatts: 180,
          percentFtp: null,
          zone: null,
        },
      ],
    })
    await store.createScheduledRide({
      workoutId: workout.id,
      startsAt: new Date(2026, 9, 23, 8, 0, 0).toISOString(),
      purpose: null,
    })
    await connect(mirror)
    const insertsBefore = calls.filter(
      (call) => call.method === 'POST' && call.url.includes('/events'),
    ).length
    missing = true
    await mirror.reconcile()
    const insertsAfter = calls.filter(
      (call) => call.method === 'POST' && call.url.includes('/events'),
    ).length
    expect(insertsAfter).toBe(insertsBefore + 1)
  })
})

function mirrorWith(
  store: LocalStore,
  fetchImpl: typeof fetch,
  now: number,
): CalendarMirror {
  return new CalendarMirror({
    store,
    config: { clientId: 'cid', clientSecret: 'secret' },
    companionOrigin: 'http://127.0.0.1:8787',
    webOrigin: 'http://127.0.0.1:5173',
    fetchImpl,
    now: () => now,
  })
}

async function connect(mirror: CalendarMirror): Promise<string> {
  const { url } = mirror.beginAuthorize()
  const state = new URL(url).searchParams.get('state')
  return mirror.completeOAuth({
    code: 'auth-code',
    state,
    scope: SCOPE,
    error: null,
  })
}

function fakeGoogle(
  calls: Array<{ url: string; method: string; body: Record<string, unknown> | null }>,
  options: {
    failEvents?: boolean
    onPatch?: () => 'updated' | 'missing'
  } = {},
): typeof fetch {
  let eventSeq = 0
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    let body: Record<string, unknown> | null = null
    if (typeof init?.body === 'string' && init.body.startsWith('{')) {
      body = JSON.parse(init.body) as Record<string, unknown>
    }
    calls.push({ url, method, body })

    if (url.includes('oauth2.googleapis.com/token')) {
      return json({
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        expires_in: 3600,
        scope: SCOPE,
        token_type: 'Bearer',
      })
    }
    if (method === 'POST' && url.endsWith('/calendars')) {
      return json({ id: 'cal-1', summary: 'OpenTrainer' })
    }
    if (method === 'GET' && url.includes('/calendars/cal-1') && !url.includes('/events')) {
      return json({ id: 'cal-1', summary: 'OpenTrainer' })
    }
    if (method === 'POST' && url.includes('/events')) {
      if (options.failEvents) return new Response('nope', { status: 500 })
      eventSeq += 1
      return json({ id: `evt-${eventSeq}` })
    }
    if (method === 'PATCH' && url.includes('/events/')) {
      if (options.onPatch?.() === 'missing') {
        return new Response('gone', { status: 404 })
      }
      return json({ id: 'evt-patched' })
    }
    if (method === 'DELETE' && url.includes('/events/')) {
      return new Response(null, { status: 204 })
    }
    return new Response(`unexpected ${method} ${url}`, { status: 500 })
  }) as typeof fetch
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
