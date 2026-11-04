import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Integrations settings file in the app's user-data folder. */
export const SETTINGS_FILE_NAME = 'companion.env'

/** Local Store folder inside the app's user-data folder. */
export const DATA_DIR_NAME = 'data'

export const SETTINGS_TEMPLATE = `# OpenTrainer integrations (optional)
#
# Strava upload and the Google Calendar Mirror each need your own API app.
# Paste the client id and secret after the = sign, save this file, then
# choose "Restart OpenTrainer" from the app menu.
# Lines starting with # are ignored. This file holds secrets: do not share it.
#
# Strava: create an app at https://www.strava.com/settings/api
#   (needs a paid Strava subscription). Authorization Callback Domain: localhost
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=

# Google Calendar Mirror: Google Cloud Console > APIs & Services > Credentials
#   > OAuth client ID > Web application.
#   Authorized redirect URI: http://127.0.0.1:8787/api/google-calendar/callback
#   Consent screen can stay in Testing; add your Google account as a test user.
#   Scope: https://www.googleapis.com/auth/calendar.app.created
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Advanced: use another port when 8787 is taken. The Strava and Google
# redirect URIs above must use the same port.
# D100_COMPANION_PORT=8787
`

/** Write the commented settings template unless the file already exists. */
export async function ensureSettingsFile(path: string): Promise<boolean> {
  if (existsSync(path)) return false
  await writeFile(path, SETTINGS_TEMPLATE, { encoding: 'utf8', mode: 0o600 })
  return true
}

/**
 * Create the Local Store on first run and copy the sample workouts into it,
 * the same two the repo ships in `companion/data/workouts/`. An existing
 * store is left alone, so a rider who deletes a sample keeps it deleted.
 */
export async function seedDataDir(dataDir: string, sampleWorkoutsDir: string): Promise<boolean> {
  if (existsSync(dataDir)) return false
  const workoutsDir = join(dataDir, 'workouts')
  await mkdir(workoutsDir, { recursive: true })
  let names: string[] = []
  try {
    names = await readdir(sampleWorkoutsDir)
  } catch {
    return true
  }
  for (const name of names) {
    if (!/^sample-.*\.json$/.test(name)) continue
    // readFile + writeFile instead of copyFile: the source may sit inside app.asar.
    const body = await readFile(join(sampleWorkoutsDir, name))
    await writeFile(join(workoutsDir, name), body)
  }
  return true
}
