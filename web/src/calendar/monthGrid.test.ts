import { describe, expect, it } from 'vitest'
import { dayKey, dayRangeIso, monthCells } from './monthGrid'

describe('monthCells', () => {
  it('builds a Monday-first grid for October 2026', () => {
    // Oct 1 2026 is Thursday → 3 leading pads (Mon Tue Wed)
    const cells = monthCells(2026, 9)
    expect(cells.slice(0, 3)).toEqual([null, null, null])
    expect(dayKey(cells[3]!)).toBe('2026-10-01')
    expect(cells.filter(Boolean)).toHaveLength(31)
  })
})

describe('dayRangeIso', () => {
  it('covers the local calendar day from midnight to end of day', () => {
    const mid = new Date(2026, 9, 9, 15, 30, 0)
    const { since, until } = dayRangeIso(mid)
    expect(new Date(since)).toEqual(new Date(2026, 9, 9, 0, 0, 0, 0))
    expect(new Date(until)).toEqual(new Date(2026, 9, 9, 23, 59, 59, 999))
  })
})
