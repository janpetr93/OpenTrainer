export type StravaConfig = {
  clientId: string
  clientSecret: string
}

export function readStravaConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): StravaConfig | null {
  const clientId = env.STRAVA_CLIENT_ID?.trim()
  const clientSecret = env.STRAVA_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}
