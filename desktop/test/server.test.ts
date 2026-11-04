import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createDesktopServer, oauthReturnSearch, type DesktopServer } from '../src/server.js'

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      const port = typeof address === 'object' && address ? address.port : 0
      probe.close(() => resolve(port))
    })
  })
}

describe('desktop server', () => {
  let root: string
  let webRoot: string
  let dataDir: string
  let server: DesktopServer | null
  const returns: string[] = []

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ot-desktop-'))
    webRoot = join(root, 'web')
    dataDir = join(root, 'data')
    await mkdir(join(webRoot, 'assets'), { recursive: true })
    await writeFile(join(webRoot, 'index.html'), '<!doctype html><title>OpenTrainer</title>')
    await writeFile(join(webRoot, 'assets', 'index-abc.js'), 'console.log(1)')
    returns.length = 0
    server = await createDesktopServer({
      dataDir,
      webRoot,
      port: await freePort(),
      env: {},
      onOAuthReturn: (search) => returns.push(search),
      log: () => {},
    })
    await server.listen()
  })

  afterEach(async () => {
    await server?.close()
    server = null
    await rm(root, { recursive: true, force: true })
  })

  it('answers the companion API under /api', async () => {
    const res = await fetch(`${server!.origin}/api/health`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    const workouts = await fetch(`${server!.origin}/api/workouts`)
    expect(workouts.status).toBe(200)
  })

  it('reports integrations as not configured without credentials', async () => {
    expect(server!.stravaConfigured).toBe(false)
    expect(server!.googleCalendarConfigured).toBe(false)
    const status = (await (await fetch(`${server!.origin}/api/strava/status`)).json()) as {
      configured: boolean
    }
    expect(status.configured).toBe(false)
  })

  it('serves the web UI with an index fallback for app paths', async () => {
    const index = await fetch(`${server!.origin}/`)
    expect(index.headers.get('content-type')).toContain('text/html')
    expect(index.headers.get('cache-control')).toBe('no-cache')
    expect(await index.text()).toContain('<title>OpenTrainer</title>')

    const deep = await fetch(`${server!.origin}/calendar`)
    expect(await deep.text()).toContain('<title>OpenTrainer</title>')

    const asset = await fetch(`${server!.origin}/assets/index-abc.js`)
    expect(asset.headers.get('content-type')).toContain('text/javascript')
    expect(asset.headers.get('cache-control')).toContain('immutable')

    expect((await fetch(`${server!.origin}/assets/missing.js`)).status).toBe(404)
  })

  it('does not serve files outside the web root', async () => {
    await writeFile(join(root, 'secret.txt'), 'nope')
    const res = await fetch(`${server!.origin}/%2e%2e/secret.txt`)
    expect(res.status).not.toBe(200)
    expect(await res.text()).not.toContain('nope')
  })

  it('hands an OAuth return back to the app with only the known query keys', async () => {
    const res = await fetch(
      `${server!.origin}/desktop/oauth-return/?strava=linked&next=https://evil.example`,
    )
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('Strava connected')
    expect(returns).toEqual(['strava=linked'])
  })

  it('rejects with EADDRINUSE when the port is taken', async () => {
    const second = await createDesktopServer({
      dataDir,
      webRoot,
      port: server!.port,
      env: {},
      log: () => {},
    })
    await expect(second.listen()).rejects.toMatchObject({ code: 'EADDRINUSE' })
  })
})

describe('oauthReturnSearch', () => {
  it('keeps strava, googleCalendar and message only', () => {
    expect(oauthReturnSearch('?googleCalendar=error&message=No%20scope&x=1')).toBe(
      'googleCalendar=error&message=No+scope',
    )
    expect(oauthReturnSearch('')).toBe('')
  })
})
