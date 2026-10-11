import type { PowerProfilePoint } from '../api'

export type SampleMetrics = {
  watts: number | null
  hrBpm?: number | null
  cadenceRpm?: number | null
  meterWatts?: number | null
  trainerWatts?: number | null
}

function pointFromMetrics(tSec: number, metrics: SampleMetrics): PowerProfilePoint | null {
  if (metrics.watts === null || !Number.isFinite(metrics.watts)) return null
  const point: PowerProfilePoint = { tSec, watts: metrics.watts }
  if (metrics.hrBpm !== null && metrics.hrBpm !== undefined) {
    point.hrBpm = metrics.hrBpm
  }
  if (metrics.cadenceRpm !== null && metrics.cadenceRpm !== undefined) {
    point.cadenceRpm = metrics.cadenceRpm
  }
  if (metrics.meterWatts !== null && metrics.meterWatts !== undefined) {
    point.meterWatts = metrics.meterWatts
  }
  if (metrics.trainerWatts !== null && metrics.trainerWatts !== undefined) {
    point.trainerWatts = metrics.trainerWatts
  }
  return point
}

/** Record ~1 Hz achieved Power Profile points during a ride (optional sensors). */
export class PowerSampler {
  private samples: PowerProfilePoint[] = []
  private lastSec = -1

  reset(): void {
    this.samples = []
    this.lastSec = -1
  }

  record(elapsedSec: number, metrics: SampleMetrics): void {
    const sec = Math.max(0, Math.floor(elapsedSec))
    const point = pointFromMetrics(sec, metrics)
    if (!point) return

    if (sec === this.lastSec && this.samples.length > 0) {
      this.samples[this.samples.length - 1] = point
      return
    }
    this.samples.push(point)
    this.lastSec = sec
  }

  getProfile(): PowerProfilePoint[] {
    return this.samples.map((p) => ({ ...p }))
  }

  summarize(): {
    averagePowerWatts: number | null
    maxPowerWatts: number | null
    durationSec: number
  } {
    if (this.samples.length === 0) {
      return { averagePowerWatts: null, maxPowerWatts: null, durationSec: 0 }
    }
    const watts = this.samples.map((p) => p.watts)
    const sum = watts.reduce((a, b) => a + b, 0)
    const durationSec = this.samples[this.samples.length - 1]!.tSec
    return {
      averagePowerWatts: Math.round(sum / watts.length),
      maxPowerWatts: Math.max(...watts),
      durationSec,
    }
  }
}
