import { estimatedFtpFromMmp } from './meanMaximalPower.js'
import type { MmpCache } from './types.js'

export type MmpViewPoint = {
  durationSec: number
  watts: number | null
  activityId: string | null
  startedAt: string | null
  /** Percent of set FTP; null when watts or FTP missing. */
  percentFtp: number | null
}

export type MmpView = {
  points: MmpViewPoint[]
  computedAt: string | null
  stale: boolean
  setFtpWatts: number | null
  estimatedFtpWatts: number | null
  /** estimated − set; null if either missing. */
  estimatedFtpDeltaWatts: number | null
  activityCount: number
}

export function enrichMmpView(
  cache: MmpCache | null,
  stale: boolean,
  setFtpWatts: number | null,
): MmpView {
  const points: MmpViewPoint[] = (cache?.points ?? []).map((p) => ({
    durationSec: p.durationSec,
    watts: p.watts,
    activityId: p.activityId,
    startedAt: p.startedAt,
    percentFtp:
      p.watts !== null && setFtpWatts !== null && setFtpWatts > 0
        ? Math.round((p.watts / setFtpWatts) * 100)
        : null,
  }))

  const estimatedFtpWatts = cache ? estimatedFtpFromMmp(cache.points) : null

  const estimatedFtpDeltaWatts =
    estimatedFtpWatts !== null && setFtpWatts !== null
      ? estimatedFtpWatts - setFtpWatts
      : null

  return {
    points,
    computedAt: cache?.computedAt ?? null,
    stale,
    setFtpWatts,
    estimatedFtpWatts,
    estimatedFtpDeltaWatts,
    activityCount: cache?.activityCount ?? 0,
  }
}

/** Build the MMP API/MCP payload from the Local Store. */
export async function loadMmpView(store: {
  getMmpCache: () => Promise<MmpCache | null>
  isMmpStale: (cache: MmpCache | null) => Promise<boolean>
  getRiderProfile: () => Promise<{ ftpWatts: number | null }>
}): Promise<MmpView> {
  const cache = await store.getMmpCache()
  const [stale, profile] = await Promise.all([
    store.isMmpStale(cache),
    store.getRiderProfile(),
  ])
  return enrichMmpView(cache, stale, profile.ftpWatts)
}
