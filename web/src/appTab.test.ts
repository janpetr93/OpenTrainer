import { describe, expect, it } from 'vitest'
import { APP_TAB_ORDER, initialAppTab } from './appTab'

describe('APP_TAB_ORDER', () => {
  it('places Devices immediately after Ride', () => {
    expect(APP_TAB_ORDER).toEqual([
      'ride',
      'devices',
      'history',
      'calendar',
      'profile',
    ])
  })
})

describe('initialAppTab', () => {
  it('opens Profile when Strava or Google Calendar OAuth returns a query flag', () => {
    expect(initialAppTab('?strava=linked')).toBe('profile')
    expect(initialAppTab('?strava=error&message=nope')).toBe('profile')
    expect(initialAppTab('?googleCalendar=linked')).toBe('profile')
    expect(initialAppTab('?googleCalendar=error&message=nope')).toBe('profile')
  })

  it('defaults to Ride when there is no Strava return', () => {
    expect(initialAppTab('')).toBe('ride')
    expect(initialAppTab('?foo=1')).toBe('ride')
  })
})
