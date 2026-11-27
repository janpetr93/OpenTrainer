import { unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  IN_PROGRESS_RIDE_FILE,
  parseInProgressRide,
} from '../../companion/src/domain/inProgressRide.js'

/**
 * Write or clear the in-progress ride on disk. Used from the desktop
 * process on a synchronous IPC so reload and quit keep the last second.
 * `null` clears it. A body the store would reject is left unwritten.
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
  writeFileSync(path, `${JSON.stringify({ ...ride, updatedAt: new Date().toISOString() }, null, 2)}\n`, 'utf8')
}
