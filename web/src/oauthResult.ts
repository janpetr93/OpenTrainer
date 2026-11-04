/** sessionStorage key the desktop app sets when a sign-in finishes during a ride. */
export const OAUTH_RESULT_STORAGE_KEY = 'opentrainer-oauth'

type OAuthResultStorage = {
  getItem(key: string): string | null
  removeItem(key: string): void
}

/**
 * Search string Profile should read after sign-in.
 * A result stashed during a ride wins once, then the URL is used.
 */
export function takeOAuthSearch(locationSearch: string, storage: OAuthResultStorage): string {
  const stored = storage.getItem(OAUTH_RESULT_STORAGE_KEY)
  if (!stored) return locationSearch
  storage.removeItem(OAUTH_RESULT_STORAGE_KEY)
  return stored.startsWith('?') ? stored : `?${stored}`
}

/** A running or paused ride must stay on this page. Reloading it drops Bluetooth. */
export function rideHoldsTheWindow(status: string): boolean {
  return status === 'running' || status === 'paused'
}
