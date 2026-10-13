import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LocalStore } from '../store/localStore.js'
import { StravaLinkService } from './service.js'

describe('StravaLinkService', () => {
  let root: string
  let store: LocalStore

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'd100-strava-'))
    store = new LocalStore(root)
    await store.ensureReady()
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('reports not configured when credentials are missing', async () => {
    const service = new StravaLinkService({
      store,
      config: null,
      companionOrigin: 'http://127.0.0.1:8787',
      webOrigin: 'http://127.0.0.1:5173',
    })
    await expect(service.getStatus()).resolves.toEqual({
      configured: false,
      linked: false,
      athleteName: null,
      athleteId: null,
      scope: null,
    })
  })

  it('completes OAuth and uploads an Activity FIT via mocked Strava API', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/oauth/token') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            token_type: 'Bearer',
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            expires_in: 3600,
            refresh_token: 'refresh-1',
            access_token: 'access-1',
            athlete: { id: 42, firstname: 'Ada', lastname: 'Rider' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      if (url.includes('/api/v3/uploads') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({
            id: 99,
            status: 'Your activity is being processed.',
            activity_id: null,
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response('unexpected', { status: 500 })
    })

    const service = new StravaLinkService({
      store,
      config: { clientId: 'cid', clientSecret: 'secret' },
      companionOrigin: 'http://127.0.0.1:8787',
      webOrigin: 'http://127.0.0.1:5173',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    })

    const { url } = service.beginAuthorize()
    const authorize = new URL(url)
    expect(authorize.searchParams.get('client_id')).toBe('cid')
    expect(authorize.searchParams.get('scope')).toBe('activity:write')
    const state = authorize.searchParams.get('state')
    expect(state).toBeTruthy()

    const redirect = await service.completeOAuth({
      code: 'auth-code',
      state,
      scope: 'activity:write',
      error: null,
    })
    expect(redirect).toContain('strava=linked')

    const status = await service.getStatus()
    expect(status).toMatchObject({
      configured: true,
      linked: true,
      athleteId: 42,
      athleteName: 'Ada Rider',
    })

    const activity = await store.saveActivity({
      startedAt: new Date().toISOString(),
      durationSec: 60,
      averagePowerWatts: 150,
      maxPowerWatts: 180,
      achievedPowerProfile: [
        { tSec: 0, watts: 140 },
        { tSec: 60, watts: 160 },
      ],
      plannedPowerProfile: null,
      workoutId: null,
    })

    const fitBase64 = Buffer.from('FITDATA').toString('base64')
    const uploaded = await service.uploadActivity({
      activityId: activity.id,
      fitBase64,
      name: 'OpenTrainer: Free Ride',
      description: 'Raise lactate threshold\n\nNP 245 · IF 0.89 · TSS 78',
    })
    expect(uploaded.uploadId).toBe(99)
    expect(uploaded.activity?.stravaUpload?.uploadId).toBe(99)

    const uploadCall = fetchImpl.mock.calls.find(([u]) =>
      String(u).includes('/api/v3/uploads'),
    )
    expect(uploadCall).toBeTruthy()
    const uploadBody = uploadCall![1]?.body as FormData
    expect(uploadBody.get('name')).toBe('OpenTrainer: Free Ride')
    expect(uploadBody.get('description')).toBe(
      'Raise lactate threshold\n\nNP 245 · IF 0.89 · TSS 78',
    )

    await expect(
      service.uploadActivity({ activityId: activity.id, fitBase64 }),
    ).rejects.toThrow(/already uploaded/i)

    const forced = await service.uploadActivity({
      activityId: activity.id,
      fitBase64,
      force: true,
    })
    expect(forced.uploadId).toBe(99)
  })
})
