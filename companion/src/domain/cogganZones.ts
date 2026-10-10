export type PowerZoneId = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type PowerZoneBand = {
  zone: PowerZoneId
  name: string
  /** Inclusive lower % of FTP (0–100+). */
  minPercentFtp: number
  /** Exclusive upper % of FTP; null = open-ended. */
  maxPercentFtp: number | null
}

/** Classic Coggan seven-zone model (% of FTP). */
export const COGGAN_ZONES: PowerZoneBand[] = [
  { zone: 1, name: 'Active Recovery', minPercentFtp: 0, maxPercentFtp: 55 },
  { zone: 2, name: 'Endurance', minPercentFtp: 55, maxPercentFtp: 75 },
  { zone: 3, name: 'Tempo', minPercentFtp: 75, maxPercentFtp: 90 },
  { zone: 4, name: 'Threshold', minPercentFtp: 90, maxPercentFtp: 105 },
  { zone: 5, name: 'VO2max', minPercentFtp: 105, maxPercentFtp: 120 },
  { zone: 6, name: 'Anaerobic', minPercentFtp: 120, maxPercentFtp: 150 },
  { zone: 7, name: 'Neuromuscular', minPercentFtp: 150, maxPercentFtp: null },
]

export type ResolvedPowerZone = PowerZoneBand & {
  minWatts: number
  maxWatts: number | null
  /** Midpoint (or low+15% for Z7) used as default target. */
  targetWatts: number
}

export function zonesFromFtp(ftpWatts: number): ResolvedPowerZone[] {
  if (!Number.isFinite(ftpWatts) || ftpWatts <= 0) {
    throw new Error('FTP must be a positive number')
  }
  return COGGAN_ZONES.map((band) => {
    const minWatts = Math.round((band.minPercentFtp / 100) * ftpWatts)
    const maxWatts =
      band.maxPercentFtp === null
        ? null
        : Math.round((band.maxPercentFtp / 100) * ftpWatts)
    const targetWatts =
      maxWatts === null
        ? Math.round(minWatts * 1.1)
        : Math.round((minWatts + maxWatts) / 2)
    return { ...band, minWatts, maxWatts, targetWatts }
  })
}
