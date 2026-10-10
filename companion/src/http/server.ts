import { createServer } from 'node:http'
import { LocalStore } from '../store/localStore.js'
import { resolveDataDir } from '../paths.js'
import { loadCompanionEnv } from '../env.js'
import { readStravaConfigFromEnv } from '../strava/config.js'
import { createRequestHandler } from './createApp.js'

loadCompanionEnv()

const port = Number(process.env.D100_COMPANION_PORT ?? 8787)
const dataDir = resolveDataDir()
const companionOrigin =
  process.env.D100_COMPANION_ORIGIN ?? `http://127.0.0.1:${port}`
const webOrigin = process.env.D100_WEB_ORIGIN ?? 'http://127.0.0.1:5173'

async function main(): Promise<void> {
  const store = new LocalStore(dataDir)
  await store.ensureReady()
  await store.backfillActivityMetrics()

  const stravaConfig = readStravaConfigFromEnv()
  const handler = createRequestHandler(store, {
    stravaConfig,
    companionOrigin,
    webOrigin,
  })
  const server = createServer((req, res) => {
    void handler(req, res)
  })

  server.listen(port, '127.0.0.1', () => {
    console.error(`OpenTrainer companion listening on http://127.0.0.1:${port}`)
    console.error(`Local Store: ${dataDir}`)
    if (stravaConfig) {
      console.error('Strava: configured (client id present)')
    } else {
      console.error(
        'Strava: not configured (set STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET in companion/.env)',
      )
    }
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
