/** Top-level nav order: Ride · Devices · History · Calendar · Profile. */
export const APP_TAB_ORDER = [
  'ride',
  'devices',
  'history',
  'calendar',
  'profile',
] as const

export type AppTab = (typeof APP_TAB_ORDER)[number]

/** Initial top-level tab from the location search string (e.g. `window.location.search`). */
export function initialAppTab(search: string): AppTab {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`)
  if (params.get('strava') || params.get('googleCalendar')) return 'profile'
  return 'ride'
}
