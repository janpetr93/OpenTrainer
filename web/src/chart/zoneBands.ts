import {
  zonesFromFtp,
  type ResolvedPowerZone,
} from '../domain/cogganZones'

export type ZoneBandRect = {
  zone: ResolvedPowerZone['zone']
  name: string
  /** Inclusive lower bound in watts. */
  minWatts: number
  /** Exclusive upper bound in watts (chart top for Z7). */
  maxWatts: number
}

/**
 * Shared watts ceiling for power series + zone bands.
 * At least ~165% FTP so Z7 has a visible band above Z6; grows with ride data.
 */
export function powerAxisMaxWatts(input: {
  ftpWatts: number
  dataMaxWatts: number
}): number {
  const floor = Math.round(input.ftpWatts * 1.65)
  return Math.max(input.dataMaxWatts, floor, 1)
}

/** Closed watt ranges for drawing (Z7 capped at axis max). */
export function zoneBandRects(
  ftpWatts: number,
  axisMaxWatts: number,
): ZoneBandRect[] {
  const zones = zonesFromFtp(ftpWatts)
  return zones.map((z) => ({
    zone: z.zone,
    name: z.name,
    minWatts: z.minWatts,
    maxWatts: z.maxWatts === null ? axisMaxWatts : Math.min(z.maxWatts, axisMaxWatts),
  })).filter((b) => b.maxWatts > b.minWatts)
}

export function wattsToY(
  watts: number,
  axisMaxWatts: number,
  height: number,
  padTop: number,
  padBottom: number = padTop,
): number {
  const usable = height - padTop - padBottom
  const clamped = Math.min(Math.max(watts, 0), axisMaxWatts)
  return height - padBottom - (clamped / axisMaxWatts) * usable
}
