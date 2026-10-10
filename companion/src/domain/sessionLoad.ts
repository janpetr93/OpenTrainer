import { COGGAN_ZONES, type PowerZoneId } from './cogganZones.js'
import { contiguousWattSegments } from './meanMaximalPower.js'
import type { PowerProfilePoint } from './types.js'

const NP_MIN_SAMPLES = 30
const ROLLING_WINDOW_SEC = 30

export type TimeInZonesSec = Record<PowerZoneId, number>

export type SessionLoad = {
  ftpWattsAtSave: number
  /** Null when fewer than 30 contiguous samples available for Coggan NP. */
  normalizedPowerWatts: number | null
  intensityFactor: number | null
  trainingStressScore: number | null
  timeInZonesSec: TimeInZonesSec
}

function emptyZones(): TimeInZonesSec {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 }
}

function zoneForWatts(watts: number, ftpWatts: number): PowerZoneId {
  const pct = (watts / ftpWatts) * 100
  for (const band of COGGAN_ZONES) {
    const underMax =
      band.maxPercentFtp === null || pct < band.maxPercentFtp
    if (pct >= band.minPercentFtp && underMax) {
      return band.zone
    }
  }
  return 7
}

function countTimeInZones(wattsSeries: number[], ftpWatts: number): TimeInZonesSec {
  const zones = emptyZones()
  for (const w of wattsSeries) {
    zones[zoneForWatts(w, ftpWatts)] += 1
  }
  return zones
}

/** Flatten contiguous 1 Hz segments into one series (gaps dropped). */
export function flattenWattSeries(points: PowerProfilePoint[]): number[] {
  const segments = contiguousWattSegments(points)
  const out: number[] = []
  for (const seg of segments) out.push(...seg)
  return out
}

/**
 * Coggan Normalized Power: 30s rolling mean, ^4, mean, fourth root.
 * Returns null if fewer than 30 samples.
 */
export function normalizedPowerWatts(wattsSeries: number[]): number | null {
  if (wattsSeries.length < NP_MIN_SAMPLES) return null

  const rolling: number[] = []
  let sum = 0
  for (let i = 0; i < wattsSeries.length; i++) {
    sum += wattsSeries[i]!
    if (i >= ROLLING_WINDOW_SEC) {
      sum -= wattsSeries[i - ROLLING_WINDOW_SEC]!
    }
    if (i >= ROLLING_WINDOW_SEC - 1) {
      rolling.push(sum / ROLLING_WINDOW_SEC)
    }
  }
  if (rolling.length === 0) return null

  let fourthSum = 0
  for (const m of rolling) {
    fourthSum += m ** 4
  }
  const meanFourth = fourthSum / rolling.length
  return Math.round(meanFourth ** 0.25)
}

export function computeSessionLoad(
  achievedPowerProfile: PowerProfilePoint[],
  ftpWatts: number | null,
): SessionLoad | null {
  if (ftpWatts === null || !Number.isFinite(ftpWatts) || ftpWatts <= 0) {
    return null
  }

  const series = flattenWattSeries(achievedPowerProfile)
  const timeInZonesSec = countTimeInZones(series, ftpWatts)
  const np = normalizedPowerWatts(series)

  if (np === null) {
    return {
      ftpWattsAtSave: ftpWatts,
      normalizedPowerWatts: null,
      intensityFactor: null,
      trainingStressScore: null,
      timeInZonesSec,
    }
  }

  const intensityFactor = np / ftpWatts
  const durationSec = series.length
  const trainingStressScore =
    (durationSec * np * intensityFactor) / (ftpWatts * 3600) * 100

  return {
    ftpWattsAtSave: ftpWatts,
    normalizedPowerWatts: np,
    intensityFactor: Math.round(intensityFactor * 1000) / 1000,
    trainingStressScore: Math.round(trainingStressScore * 100) / 100,
    timeInZonesSec,
  }
}
