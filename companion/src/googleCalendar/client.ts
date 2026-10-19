export const GOOGLE_CALENDAR_SCOPE =
  'https://www.googleapis.com/auth/calendar.app.created'

export const OPEN_TRAINER_CALENDAR_SUMMARY = 'OpenTrainer'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars'

export type GoogleFetch = typeof fetch

export type GoogleTokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope?: string
  token_type?: string
}

export type GoogleEventBody = {
  summary: string
  description: string
  start: { dateTime: string }
  end: { dateTime: string }
  reminders: { useDefault: false }
}

export function buildAuthorizeUrl(input: {
  clientId: string
  redirectUri: string
  state: string
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state: input.state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export function hasCalendarScope(scope: string | null | undefined): boolean {
  if (!scope) return false
  return scope.split(/[\s,]+/).includes(GOOGLE_CALENDAR_SCOPE)
}

export async function exchangeAuthorizationCode(
  fetchImpl: GoogleFetch,
  input: {
    clientId: string
    clientSecret: string
    code: string
    redirectUri: string
  },
): Promise<GoogleTokenResponse> {
  return requestToken(fetchImpl, {
    code: input.code,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: 'authorization_code',
  })
}

export async function refreshAccessToken(
  fetchImpl: GoogleFetch,
  input: {
    clientId: string
    clientSecret: string
    refreshToken: string
  },
): Promise<GoogleTokenResponse> {
  return requestToken(fetchImpl, {
    refresh_token: input.refreshToken,
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: 'refresh_token',
  })
}

export async function getCalendar(
  fetchImpl: GoogleFetch,
  input: { accessToken: string; calendarId: string },
): Promise<boolean> {
  const res = await fetchImpl(calendarUrl(input.calendarId), {
    headers: authHeaders(input.accessToken),
  })
  if (res.status === 404 || res.status === 410) return false
  if (!res.ok) throw new Error(await googleError(res))
  return true
}

export async function createCalendar(
  fetchImpl: GoogleFetch,
  input: { accessToken: string },
): Promise<{ id: string }> {
  const res = await fetchImpl(CALENDAR_API, {
    method: 'POST',
    headers: {
      ...authHeaders(input.accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ summary: OPEN_TRAINER_CALENDAR_SUMMARY }),
  })
  if (!res.ok) throw new Error(await googleError(res))
  const body = (await res.json()) as { id?: string }
  if (!body.id) throw new Error('Google Calendar create response missing id')
  return { id: body.id }
}

export async function insertEvent(
  fetchImpl: GoogleFetch,
  input: { accessToken: string; calendarId: string; event: GoogleEventBody },
): Promise<{ id: string }> {
  const res = await fetchImpl(`${calendarUrl(input.calendarId)}/events`, {
    method: 'POST',
    headers: {
      ...authHeaders(input.accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input.event),
  })
  if (!res.ok) throw new Error(await googleError(res))
  const body = (await res.json()) as { id?: string }
  if (!body.id) throw new Error('Google event create response missing id')
  return { id: body.id }
}

/** `missing` when Google no longer has the event (deleted in Calendar). */
export async function patchEvent(
  fetchImpl: GoogleFetch,
  input: {
    accessToken: string
    calendarId: string
    eventId: string
    event: GoogleEventBody
  },
): Promise<'updated' | 'missing'> {
  const res = await fetchImpl(
    `${calendarUrl(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
    {
      method: 'PATCH',
      headers: {
        ...authHeaders(input.accessToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input.event),
    },
  )
  if (res.status === 404 || res.status === 410) return 'missing'
  if (!res.ok) throw new Error(await googleError(res))
  return 'updated'
}

export async function deleteEvent(
  fetchImpl: GoogleFetch,
  input: { accessToken: string; calendarId: string; eventId: string },
): Promise<void> {
  const res = await fetchImpl(
    `${calendarUrl(input.calendarId)}/events/${encodeURIComponent(input.eventId)}`,
    {
      method: 'DELETE',
      headers: authHeaders(input.accessToken),
    },
  )
  if (res.status === 404 || res.status === 410) return
  if (!res.ok) throw new Error(await googleError(res))
}

function calendarUrl(calendarId: string): string {
  return `${CALENDAR_API}/${encodeURIComponent(calendarId)}`
}

function authHeaders(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` }
}

async function requestToken(
  fetchImpl: GoogleFetch,
  fields: Record<string, string>,
): Promise<GoogleTokenResponse> {
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(fields),
  })
  if (!res.ok) throw new Error(await googleError(res))
  const body = (await res.json()) as GoogleTokenResponse
  if (!body.access_token || !body.expires_in) {
    throw new Error('Google token response missing access_token')
  }
  return body
}

async function googleError(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const body = JSON.parse(text) as {
      error?: { message?: string } | string
      error_description?: string
    }
    if (typeof body.error === 'string') {
      return body.error_description
        ? `${body.error}: ${body.error_description}`
        : body.error
    }
    if (body.error?.message) return body.error.message
  } catch {
    // plain text
  }
  return text.trim() || `Google Calendar HTTP ${res.status}`
}
