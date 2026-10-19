export type GoogleCalendarConfig = {
  clientId: string
  clientSecret: string
}

export function readGoogleCalendarConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): GoogleCalendarConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim()
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}
