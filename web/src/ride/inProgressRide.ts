import type { InProgressRideInput, PowerProfilePoint } from '../api'
import type { RideProgress } from '../workout/workoutRunner'

type DesktopRide = {
  /** Synchronous write so a reload or quit cannot drop the last second. */
  checkpoint: (body: unknown) => void
}

type DesktopWindow = Window & {
  openTrainer?: { ride?: DesktopRide }
}

/**
 * The body stored for an in-progress ride. Duration covers the clock even
 * when the last second had no power sample.
 */
export function buildInProgressRide(input: {
  startedAt: string
  progress: RideProgress
  achievedPowerProfile: PowerProfilePoint[]
  averagePowerWatts: number | null
  maxPowerWatts: number | null
  sampleDurationSec: number
  plannedPowerProfile: PowerProfilePoint[] | null
  targetPowerProfile: PowerProfilePoint[] | null
  scheduledRideId: string | null
  purpose: string | null
  primaryPowerSource: InProgressRideInput['primaryPowerSource']
}): InProgressRideInput {
  const { progress } = input
  return {
    startedAt: input.startedAt,
    elapsedSec: progress.elapsedSec,
    durationSec: Math.max(input.sampleDurationSec, progress.elapsedSec),
    averagePowerWatts: input.averagePowerWatts,
    maxPowerWatts: input.maxPowerWatts,
    achievedPowerProfile: input.achievedPowerProfile,
    plannedPowerProfile: input.plannedPowerProfile,
    targetPowerProfile: input.targetPowerProfile,
    freeRideFromSec: progress.freeRideFromSec,
    workoutId: progress.workoutId,
    scheduledRideId: input.scheduledRideId,
    purpose: input.purpose,
    primaryPowerSource: input.primaryPowerSource,
    ftpWatts: progress.ftpWatts,
    freeRide: progress.freeRide,
    intensityPercent: progress.intensityPercent,
    intensityChanges: progress.intensityChanges,
    freeRideTargetWatts: progress.freeRideTargetWatts,
    freeRideTargetChanges: progress.freeRideTargetChanges,
  }
}

/** Write the checkpoint before the page goes away. Desktop writes synchronously. */
export function flushInProgressRide(ride: InProgressRideInput | null): void {
  const desktop = (window as DesktopWindow).openTrainer?.ride
  if (desktop) {
    desktop.checkpoint(ride)
    return
  }
  if (!ride) {
    void fetch('/api/in-progress-ride', { method: 'DELETE', keepalive: true }).catch(
      () => {},
    )
    return
  }
  void fetch('/api/in-progress-ride', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ride),
    keepalive: true,
  }).catch(() => {})
}
