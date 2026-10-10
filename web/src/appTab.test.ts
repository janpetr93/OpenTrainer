import { describe, expect, it } from 'vitest'
import { initialAppTab } from './appTab'

describe('initialAppTab', () => {
  it('opens Profile when Strava OAuth returns a query flag', () => {
    expect(initialAppTab('?strava=linked')).toBe('profile')
    expect(initialAppTab('?strava=error&message=nope')).toBe('profile')
  })

  it('defaults to Ride when there is no Strava return', () => {
    expect(initialAppTab('')).toBe('ride')
    expect(initialAppTab('?foo=1')).toBe('ride')
  })
})
