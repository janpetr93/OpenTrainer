import { describe, expect, it } from 'vitest'
import {
  OAUTH_RESULT_STORAGE_KEY,
  rideHoldsTheWindow,
  takeOAuthSearch,
} from './oauthResult'

function memoryStorage(initial?: string): Storage {
  const values = new Map<string, string>()
  if (initial !== undefined) values.set(OAUTH_RESULT_STORAGE_KEY, initial)
  return {
    getItem: (key) => values.get(key) ?? null,
    removeItem: (key) => {
      values.delete(key)
    },
  } as Storage
}

describe('takeOAuthSearch', () => {
  it('reads the page URL when nothing was stashed during a ride', () => {
    const storage = memoryStorage()
    expect(takeOAuthSearch('?strava=linked', storage)).toBe('?strava=linked')
    expect(storage.getItem(OAUTH_RESULT_STORAGE_KEY)).toBeNull()
  })

  it('returns a stashed sign-in result once', () => {
    const storage = memoryStorage('strava=error&message=access_denied')
    expect(takeOAuthSearch('', storage)).toBe('?strava=error&message=access_denied')
    expect(takeOAuthSearch('?strava=linked', storage)).toBe('?strava=linked')
  })
})

describe('rideHoldsTheWindow', () => {
  it('keeps a running or paused ride from being reloaded', () => {
    expect(rideHoldsTheWindow('running')).toBe(true)
    expect(rideHoldsTheWindow('paused')).toBe(true)
    expect(rideHoldsTheWindow('idle')).toBe(false)
    expect(rideHoldsTheWindow('stopped')).toBe(false)
    expect(rideHoldsTheWindow('completed')).toBe(false)
  })
})
