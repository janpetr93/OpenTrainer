import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'
import { createRequestHandler } from '../../companion/src/http/createApp.js'
import type { StravaFetch } from '../../companion/src/strava/client.js'
import { LocalStore } from '../../companion/src/store/localStore.js'
import { readStravaConfigFromEnv } from '../../companion/src/strava/config.js'
import { readGoogleCalendarConfigFromEnv } from '../../companion/src/googleCalendar/config.js'
import { CalendarMirror } from '../../companion/src/googleCalendar/service.js'
import { OAUTH_HANDOFF_PARAM } from '../../companion/src/oauthHandoff.js'
import { createOAuthHandoff } from './oauthHandoff.js'
import { serveStatic } from './staticFiles.js'

/**
 * Where the companion sends the browser after a Strava / Google sign-in.
 * Sign-in runs in the system browser, so this page tells the rider to go back
 * to the app. The app reloads only when the URL carries a one-time handoff
 * the companion issued after checking the OAuth state.
 */
export const OAUTH_RETURN_PATH = '/desktop/oauth-return'

/** Companion routes that start an OAuth sign-in (opened in the system browser). */
export const OAUTH_START_PATHS: ReadonlySet<string> = new Set([
  '/api/strava/authorize',
  '/api/google-calendar/authorize',
])

const OAUTH_RETURN_PARAMS = ['strava', 'googleCalendar', 'message'] as const

export type DesktopServerOptions = {
  dataDir: string
  webRoot: string
  port: number
  env?: NodeJS.ProcessEnv
  /** Test double for Strava and Google token calls. */
  fetchImpl?: StravaFetch
  /** Called with the filtered query (no leading `?`) after a checked sign-in returns. */
  onOAuthReturn?: (search: string) => void
  log?: (message: string) => void
}

export type DesktopServer = {
  origin: string
  port: number
  stravaConfigured: boolean
  googleCalendarConfigured: boolean
  /** Bind 127.0.0.1:port. Rejects with `code: 'EADDRINUSE'` when taken. */
  listen(): Promise<void>
  /** Catch the Calendar Mirror up with Scheduled Ride changes (never throws). */
  reconcileCalendarMirror(): Promise<void>
  close(): Promise<void>
}

/** Keep only the query keys the web UI reads after a sign-in. */
export function oauthReturnSearch(search: string): string {
  const input = new URLSearchParams(search)
  const output = new URLSearchParams()
  for (const key of OAUTH_RETURN_PARAMS) {
    const value = input.get(key)
    if (value !== null) output.set(key, value)
  }
  return output.toString()
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function oauthReturnPage(search: string): string {
  const params = new URLSearchParams(search)
  const service = params.has('googleCalendar') ? 'Google Calendar' : 'Strava'
  const flag = params.get('googleCalendar') ?? params.get('strava')
  const failed = flag !== 'linked'
  const title = failed ? `${service} was not connected` : `${service} connected`
  const detail = failed
    ? (params.get('message') ?? 'Authorization did not complete.')
    : 'You can close this tab.'
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · OpenTrainer</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
    background: #f4f6f8; color: #121417; font: 16px/1.45 'Segoe UI', system-ui, sans-serif; }
  main { max-width: 28rem; padding: 2rem; background: #fff; border: 1px solid #9aa8b5;
    border-radius: 0.4rem; }
  h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
  p { margin: 0.25rem 0; color: #3d4853; }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(detail)}</p>
  <p>Return to the OpenTrainer app to continue.</p>
</main>
</body>
</html>`
}

/**
 * The desktop app's local server: the companion HTTP API under `/api` and the
 * built web UI on the same origin, so the UI's relative `/api` calls work as
 * they do behind the Vite proxy in development.
 */
export async function createDesktopServer(
  options: DesktopServerOptions,
): Promise<DesktopServer> {
  const env = options.env ?? process.env
  const log = options.log ?? ((message: string) => console.error(message))
  const port = options.port
  const origin = `http://127.0.0.1:${port}`
  const webOrigin = `${origin}${OAUTH_RETURN_PATH}`

  const store = new LocalStore(options.dataDir)
  await store.ensureReady()
  await store.backfillActivityMetrics()

  const stravaConfig = readStravaConfigFromEnv(env)
  const googleCalendarConfig = readGoogleCalendarConfigFromEnv(env)
  const handoff = createOAuthHandoff()
  const calendarMirror = new CalendarMirror({
    store,
    config: googleCalendarConfig,
    companionOrigin: origin,
    webOrigin,
    fetchImpl: options.fetchImpl,
  })
  const companion = createRequestHandler(store, {
    stravaConfig,
    googleCalendarConfig,
    companionOrigin: origin,
    webOrigin,
    fetchImpl: options.fetchImpl,
    issueOAuthHandoff: () => handoff.issue(),
  })

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const url = new URL(req.url ?? '/', origin)
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      await companion(req, res)
      return
    }
    if (url.pathname === OAUTH_RETURN_PATH || url.pathname === `${OAUTH_RETURN_PATH}/`) {
      const search = oauthReturnSearch(url.search)
      const accepted = handoff.consume(url.searchParams.get(OAUTH_HANDOFF_PARAM))
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      })
      res.end(oauthReturnPage(search))
      if (accepted) options.onOAuthReturn?.(search)
      return
    }
    await serveStatic(req, res, options.webRoot, url.pathname)
  }

  let server: Server | null = null

  return {
    origin,
    port,
    stravaConfigured: stravaConfig !== null,
    googleCalendarConfigured: googleCalendarConfig !== null,
    listen() {
      return new Promise<void>((resolveListen, rejectListen) => {
        const candidate = createServer((req, res) => {
          handle(req, res).catch((error: unknown) => {
            log(`Request failed: ${error instanceof Error ? error.stack : String(error)}`)
            if (!res.headersSent) res.writeHead(500)
            res.end()
          })
        })
        candidate.once('error', rejectListen)
        candidate.listen(port, '127.0.0.1', () => {
          candidate.off('error', rejectListen)
          candidate.on('error', (error) => log(`Server error: ${String(error)}`))
          server = candidate
          log(`OpenTrainer listening on ${origin}`)
          log(`Local Store: ${options.dataDir}`)
          log(`Strava: ${stravaConfig ? 'configured' : 'not configured'}`)
          log(`Google Calendar: ${googleCalendarConfig ? 'configured' : 'not configured'}`)
          resolveListen()
        })
      })
    },
    async reconcileCalendarMirror() {
      try {
        await calendarMirror.reconcile()
      } catch (error) {
        log(`Calendar Mirror reconcile failed: ${String(error)}`)
      }
    },
    close() {
      const current = server
      server = null
      if (!current) return Promise.resolve()
      return new Promise<void>((resolveClose) => {
        current.close(() => resolveClose())
        current.closeAllConnections()
      })
    },
  }
}
