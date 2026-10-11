import { describe, expect, it } from 'vitest'
import {
  formatAxisBpm,
  formatAxisRpm,
  formatAxisTime,
  formatAxisWatts,
  niceAxisTicks,
  threeAxisTicks,
  wattsAxisDomain,
} from './axisTicks'

describe('threeAxisTicks', () => {
  it('returns min, mid, and max for a typical power scale', () => {
    expect(threeAxisTicks(0, 200)).toEqual([0, 100, 200])
  })

  it('works for a padded domain that does not start at zero', () => {
    expect(threeAxisTicks(90, 220)).toEqual([90, 155, 220])
  })

  it('rounds the midpoint when the span is odd', () => {
    expect(threeAxisTicks(0, 251)).toEqual([0, 126, 251])
  })
})

describe('niceAxisTicks', () => {
  it('picks round watt steps instead of raw midpoints for an FTP zone axis', () => {
    // 250 W FTP × 1.65 → ~413 W ceiling (current ride preview domain).
    expect(niceAxisTicks(0, 413, 5)).toEqual([0, 100, 200, 300, 400])
  })

  it('keeps ticks inside a zoomed watts window', () => {
    expect(niceAxisTicks(90, 220, 4)).toEqual([100, 150, 200])
  })

  it('handles a flat or tiny span without duplicating junk', () => {
    expect(niceAxisTicks(150, 150, 3)).toEqual([150])
  })
})

describe('wattsAxisDomain', () => {
  it('pads min and max by 10% of the data span', () => {
    expect(wattsAxisDomain(100, 200)).toEqual({ min: 90, max: 210 })
  })

  it('clamps the floor at 0 W (min margin still pads the top)', () => {
    // span 15 → 10% is 1.5, so minMarginWatts (10) wins: [5-10, 20+10] → [0, 30]
    expect(wattsAxisDomain(5, 20)).toEqual({ min: 0, max: 30 })
  })

  it('uses a minimum margin when the series is flat', () => {
    expect(wattsAxisDomain(150, 150)).toEqual({ min: 140, max: 160 })
  })
})

describe('formatAxisTime', () => {
  it('formats elapsed seconds as m:ss', () => {
    expect(formatAxisTime(0)).toBe('0:00')
    expect(formatAxisTime(65)).toBe('1:05')
    expect(formatAxisTime(3600)).toBe('60:00')
  })
})

describe('formatAxisWatts', () => {
  it('labels rounded watts', () => {
    expect(formatAxisWatts(0)).toBe('0 W')
    expect(formatAxisWatts(187.4)).toBe('187 W')
  })

  it('can omit the unit for inner ticks', () => {
    expect(formatAxisWatts(200, false)).toBe('200')
  })
})

describe('formatAxisBpm', () => {
  it('labels rounded heart rate', () => {
    expect(formatAxisBpm(40)).toBe('40 bpm')
    expect(formatAxisBpm(162.6)).toBe('163 bpm')
  })
})

describe('formatAxisRpm', () => {
  it('labels rounded cadence', () => {
    expect(formatAxisRpm(0)).toBe('0 rpm')
    expect(formatAxisRpm(88.2)).toBe('88 rpm')
  })
})
