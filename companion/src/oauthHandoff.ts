/** Query key for a one-time desktop handoff. The web UI does not read it. */
export const OAUTH_HANDOFF_PARAM = 'handoff'

/**
 * Browser URL the companion sends after sign-in.
 * `issue` is set only once the OAuth state has been checked, so a forged
 * callback cannot obtain a handoff.
 */
export function oauthResultUrl(
  webOrigin: string,
  params: Record<string, string>,
  issue?: () => string,
): string {
  const search = new URLSearchParams(params)
  if (issue) search.set(OAUTH_HANDOFF_PARAM, issue())
  return `${webOrigin}/?${search.toString()}`
}
