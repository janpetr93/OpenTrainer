import { renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  IN_PROGRESS_RIDE_FILE,
  parseInProgressRide,
} from '../../companion/src/domain/inProgressRide.js'

/**
 * Write or clear the in-progress ride on disk. Used from the desktop
 * process on a synchronous IPC so reload and quit keep the last second.
 * `null` clears it. A body the store would reject is left unwritten.
 * The file is replaced by rename, so a reader never sees half a ride.
 */
export function writeRideCheckpoint(dataDir: string, body: unknown): void {
  const path = join(dataDir, IN_PROGRESS_RIDE_FILE)
  if (body === null) {
    try {
      unlinkSync(path)
    } catch {
      /* already gone */
    }
    return
  }
  const ride = parseInProgressRide(body)
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`
  writeFileSync(
    tmp,
    `${JSON.stringify({ ...ride, updatedAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8',
  )
  try {
    renameSync(tmp, path)
  } catch (error) {
    try {
      unlinkSync(tmp)
    } catch {
      /* nothing to clean */
    }
    throw error
  }
}

/**
 * The reply to the page's synchronous `ride:checkpoint`. It never throws:
 * a sync IPC the main process does not answer freezes the page for good.
 * True when the checkpoint was written or cleared.
 */
export function answerRideCheckpoint(
  dataDir: string | null,
  body: unknown,
  log: (message: string) => void,
): boolean {
  if (!dataDir) return false
  try {
    writeRideCheckpoint(dataDir, body)
    return true
  } catch (error) {
    log(`Ride checkpoint rejected: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}
