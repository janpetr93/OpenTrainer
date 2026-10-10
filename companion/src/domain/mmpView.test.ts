import { describe, expect, it } from 'vitest'
import { MMP_DURATIONS_SEC } from './meanMaximalPower.js'
import { enrichMmpView } from './mmpView.js'
import type { MmpCache } from './types.js'

describe('enrichMmpView', () => {
  it('adds %FTP and Estimated FTP vs set FTP', () => {
    const cache: MmpCache = {
      schemaVersion: 1,
      computedAt: '2026-10-10T12:00:00.000Z',
      activityCount: 1,
      latestActivityId: 'a',
      latestCreatedAt: '2026-10-01T00:00:00.000Z',
      points: MMP_DURATIONS_SEC.map((durationSec) => ({
        durationSec,
        watts: durationSec === 1200 ? 300 : durationSec === 5 ? 500 : null,
        activityId: 'a',
        startedAt: '2026-10-01T00:00:00.000Z',
      })),
    }
    const view = enrichMmpView(cache, false, 250)
    expect(view.stale).toBe(false)
    expect(view.estimatedFtpWatts).toBe(285)
    expect(view.setFtpWatts).toBe(250)
    expect(view.estimatedFtpDeltaWatts).toBe(35)
    expect(view.points.find((p) => p.durationSec === 5)?.percentFtp).toBe(200)
  })

  it('returns empty points when no cache', () => {
    const view = enrichMmpView(null, true, null)
    expect(view.points).toEqual([])
    expect(view.stale).toBe(true)
    expect(view.computedAt).toBeNull()
    expect(view.estimatedFtpWatts).toBeNull()
  })
})
