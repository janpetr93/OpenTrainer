import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { IN_PROGRESS_RIDE_FILE } from '../../companion/src/domain/inProgressRide.js'
import { writeRideCheckpoint } from '../src/rideCheckpoint.js'

const ride = {
  startedAt: '2026-11-26T16:58:15.000Z',
  elapsedSec: 10,
  durationSec: 10,
  averagePowerWatts: 100,
  maxPowerWatts: 100,
  achievedPowerProfile: [{ tSec: 10, watts: 100 }],
  plannedPowerProfile: null,
  targetPowerProfile: null,
  freeRideFromSec: null,
  workoutId: null,
  scheduledRideId: null,
  purpose: null,
  primaryPowerSource: null,
  ftpWatts: null,
  freeRide: true,
  intensityPercent: 100,
  intensityChanges: [],
  freeRideTargetWatts: null,
  freeRideTargetChanges: [],
}

describe('writeRideCheckpoint', () => {
  let dir: string

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true })
  })

  it('writes the in-progress ride and clears it', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ot-checkpoint-'))
    writeRideCheckpoint(dir, ride)
    const raw = JSON.parse(await readFile(join(dir, IN_PROGRESS_RIDE_FILE), 'utf8')) as {
      elapsedSec: number
    }
    expect(raw.elapsedSec).toBe(10)

    writeRideCheckpoint(dir, null)
    await expect(readFile(join(dir, IN_PROGRESS_RIDE_FILE), 'utf8')).rejects.toThrow()
  })

  it('leaves the previous file when the body is rejected', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ot-checkpoint-'))
    writeRideCheckpoint(dir, ride)
    expect(() => writeRideCheckpoint(dir, { startedAt: 1 })).toThrow()
    const raw = JSON.parse(await readFile(join(dir, IN_PROGRESS_RIDE_FILE), 'utf8')) as {
      elapsedSec: number
    }
    expect(raw.elapsedSec).toBe(10)
  })
})
