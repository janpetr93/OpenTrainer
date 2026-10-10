export type AppTab = 'ride' | 'history' | 'calendar' | 'profile'

/** Initial top-level tab from the location search string (e.g. `window.location.search`). */
export function initialAppTab(search: string): AppTab {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  if (params.get('strava')) return 'profile'
  return 'ride'
}
