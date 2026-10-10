import type { LivePowerStatus } from '../ftms/livePowerFreshness'

/** Rolling window for Power Alignment delta (Meter − Trainer). */
export const ALIGNMENT_AVERAGE_WINDOW_MS = 5000

/**
 * Instantaneous Power Alignment delta: Meter Power − Live Power when both are fresh.
 * Positive means the Power Meter reads higher than the Trainer.
 */
export function powerAlignmentDelta(input: {
  trainerWatts: number | null
  trainerStatus: LivePowerStatus
  meterWatts: number | null
  meterStatus: LivePowerStatus
}): number | null {
  if (
    input.trainerStatus !== 'fresh' ||
    input.meterStatus !== 'fresh' ||
    input.trainerWatts === null ||
    input.meterWatts === null
  ) {
    return null
  }
  return input.meterWatts - input.trainerWatts
}

type Sample = { atMs: number; delta: number }

/**
 * Rolling ~5s average of Power Alignment deltas for a less jumpy Live Display.
 */
export class AlignmentDeltaAverager {
  private samples: Sample[] = []

  sample(input: {
    trainerWatts: number | null
    trainerStatus: LivePowerStatus
    meterWatts: number | null
    meterStatus: LivePowerStatus
    nowMs: number
  }): number | null {
    const delta = powerAlignmentDelta(input)
    if (delta !== null) {
      this.samples.push({ atMs: input.nowMs, delta })
    }

    const cutoff = input.nowMs - ALIGNMENT_AVERAGE_WINDOW_MS
    this.samples = this.samples.filter((s) => s.atMs >= cutoff)

    if (this.samples.length === 0) {
      return null
    }

    const sum = this.samples.reduce((acc, s) => acc + s.delta, 0)
    return Math.round(sum / this.samples.length)
  }

  reset(): void {
    this.samples = []
  }
}

export function formatAlignmentDelta(delta: number | null): string {
  if (delta === null) return '—'
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta} W`
}
