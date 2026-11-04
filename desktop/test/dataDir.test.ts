import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadCompanionEnv } from '../../companion/src/env.js'
import { readStravaConfigFromEnv } from '../../companion/src/strava/config.js'
import { SETTINGS_TEMPLATE, ensureSettingsFile, seedDataDir } from '../src/dataDir.js'

describe('seedDataDir', () => {
  let root: string
  let samples: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ot-seed-'))
    samples = join(root, 'samples')
    await mkdir(samples)
    await writeFile(join(samples, 'sample-easy.json'), '{"id":"sample-easy"}')
    await writeFile(join(samples, 'notes.txt'), 'not a workout')
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('copies sample workouts on first run only', async () => {
    const dataDir = join(root, 'data')
    expect(await seedDataDir(dataDir, samples)).toBe(true)
    expect(await readdir(join(dataDir, 'workouts'))).toEqual(['sample-easy.json'])

    await unlink(join(dataDir, 'workouts', 'sample-easy.json'))
    expect(await seedDataDir(dataDir, samples)).toBe(false)
    expect(await readdir(join(dataDir, 'workouts'))).toEqual([])
  })

  it('still creates the store when the samples are missing', async () => {
    const dataDir = join(root, 'data')
    expect(await seedDataDir(dataDir, join(root, 'missing'))).toBe(true)
    expect(existsSync(join(dataDir, 'workouts'))).toBe(true)
  })
})

describe('ensureSettingsFile', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'ot-settings-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('writes the template once and never overwrites edits', async () => {
    const path = join(root, 'companion.env')
    expect(await ensureSettingsFile(path)).toBe(true)
    expect(await readFile(path, 'utf8')).toBe(SETTINGS_TEMPLATE)
    await writeFile(path, 'STRAVA_CLIENT_ID=1\n')
    expect(await ensureSettingsFile(path)).toBe(false)
    expect(await readFile(path, 'utf8')).toBe('STRAVA_CLIENT_ID=1\n')
  })

  it('leaves Strava unconfigured until the template is filled in', async () => {
    const path = join(root, 'companion.env')
    await ensureSettingsFile(path)
    const saved = { ...process.env }
    try {
      delete process.env.STRAVA_CLIENT_ID
      delete process.env.STRAVA_CLIENT_SECRET
      loadCompanionEnv(path)
      expect(readStravaConfigFromEnv()).toBeNull()
    } finally {
      process.env = saved
    }
  })
})
