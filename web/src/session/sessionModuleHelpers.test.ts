import { describe, expect, it } from 'vitest'
import type { Activity } from '../api'
import {
  activityMeta,
  formatCompactDateTime,
  formatCompactTime,
  formatDuration,
  scheduledMeta,
} from './sessionModuleHelpers'

function activity(partial: Partial<Activity> = {}): Activity {
  return {
    id: 'a1',
    startedAt: '2026-10-10T17:34:50.000Z',
    durationSec: 39,
    averagePowerWatts: 0,
    maxPowerWatts: 0,
    achievedPowerProfile: [],
    plannedPowerProfile: null,
    workoutId: null,
    purpose: null,
    sessionLoad: {
      ftpWattsAtSave: 200,
      normalizedPowerWatts: 0,
      intensityFactor: 0,
      trainingStressScore: 0,
      timeInZonesSec: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
    },
    ...partial,
  }
}

describe('formatDuration', () => {
  it('rounds fractional seconds', () => {
    expect(formatDuration(66.448)).toBe('1m 6s')
    expect(formatDuration(60)).toBe('1m')
  })
})

describe('formatCompactDateTime', () => {
  it('uses short month, day, and HH:MM without seconds', () => {
    const label = formatCompactDateTime('2026-10-10T17:34:50.000Z')
    expect(label).toMatch(/Oct/)
    expect(label).toMatch(/10/)
    expect(label).toContain('·')
    expect(label).not.toMatch(/:\d{2}$/)
  })
})

describe('formatCompactTime', () => {
  it('returns local HH:MM', () => {
    const label = formatCompactTime('2026-10-10T17:34:50.000Z')
    expect(label).toMatch(/^\d{1,2}:\d{2}/)
  })
})

describe('activityMeta', () => {
  it('always includes duration and power/load metrics including zeros', () => {
    const meta = activityMeta(activity())
    expect(meta.kind).toBeNull()
    expect(meta.metrics).toEqual([
      { label: 'Duration', value: '0m 39s' },
      { label: 'Avg', value: '0 W' },
      { label: 'Max', value: '0 W' },
      { label: 'NP', value: '0 W' },
      { label: 'IF', value: '0.00' },
      { label: 'TSS', value: '0' },
    ])
  })

  it('uses vs plan when a planned profile exists', () => {
    const meta = activityMeta(
      activity({
        plannedPowerProfile: [
          { tSec: 0, watts: 100 },
          { tSec: 60, watts: 100 },
        ],
        averagePowerWatts: 180,
        maxPowerWatts: 220,
        sessionLoad: {
          ftpWattsAtSave: 200,
          normalizedPowerWatts: 190,
          intensityFactor: 0.95,
          trainingStressScore: 42,
          timeInZonesSec: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 },
        },
      }),
    )
    expect(meta.kind).toBe('vs plan')
    expect(meta.metrics.find((m) => m.label === 'Avg')?.value).toBe('180 W')
    expect(meta.metrics.find((m) => m.label === 'IF')?.value).toBe('0.95')
  })

  it('fills missing power/load with zeros', () => {
    const meta = activityMeta(
      activity({
        averagePowerWatts: null,
        maxPowerWatts: null,
        sessionLoad: null,
      }),
    )
    expect(meta.metrics.map((m) => m.value)).toEqual([
      '0m 39s',
      '0 W',
      '0 W',
      '0 W',
      '0.00',
      '0',
    ])
  })

  it('appends adherence metrics when present', () => {
    const meta = activityMeta(
      activity({
        sessionAdherence: {
          completionRatio: 0.8,
          targetAdherence: 0.65,
        },
      }),
    )
    expect(meta.metrics.at(-2)).toEqual({ label: 'Done', value: '80%' })
    expect(meta.metrics.at(-1)).toEqual({ label: 'On-target', value: '65%' })
  })

  it('inserts Average Alignment Delta after Max when present', () => {
    const meta = activityMeta(
      activity({ averageAlignmentDeltaWatts: 8 }),
    )
    const labels = meta.metrics.map((m) => m.label)
    expect(labels.indexOf('Δ')).toBe(labels.indexOf('Max') + 1)
    expect(meta.metrics.find((m) => m.label === 'Δ')?.value).toBe('+8 W')
  })

  it('omits Δ when Average Alignment Delta is null', () => {
    const meta = activityMeta(
      activity({ averageAlignmentDeltaWatts: null }),
    )
    expect(meta.metrics.some((m) => m.label === 'Δ')).toBe(false)
  })
})

describe('scheduledMeta', () => {
  it('shows time, duration, and optional outcome', () => {
    const meta = scheduledMeta('2026-10-10T17:34:50.000Z', '45m', 'completed')
    expect(meta.kind).toBeNull()
    expect(meta.metrics).toEqual([
      { label: 'Duration', value: '45m' },
      { label: 'Status', value: 'completed' },
    ])
    expect(meta.when).toMatch(/^\d{1,2}:\d{2}/)
  })

  it('supports a kind tag without outcome', () => {
    const meta = scheduledMeta(null, '30m', null, 'From Calendar')
    expect(meta.when).toBe('')
    expect(meta.kind).toBe('From Calendar')
    expect(meta.metrics).toEqual([{ label: 'Duration', value: '30m' }])
  })
})
