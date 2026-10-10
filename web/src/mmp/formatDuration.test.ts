import { describe, expect, it } from 'vitest'
import { formatMmpDuration } from './formatDuration'

describe('formatMmpDuration', () => {
  it('formats seconds and whole minutes', () => {
    expect(formatMmpDuration(5)).toBe('5s')
    expect(formatMmpDuration(60)).toBe('1min')
    expect(formatMmpDuration(1200)).toBe('20min')
    expect(formatMmpDuration(5400)).toBe('90min')
  })
})
