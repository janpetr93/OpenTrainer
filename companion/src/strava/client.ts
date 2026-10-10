export type StravaTokenResponse = {
  token_type: string
  expires_at: number
  expires_in: number
  refresh_token: string
  access_token: string
  athlete?: {
    id: number
    firstname?: string
    lastname?: string
    username?: string | null
  }
}

export type StravaUploadResponse = {
  id: number
  id_str?: string
  external_id?: string | null
  error?: string | null
  status?: string
  activity_id?: number | null
}

export type StravaFetch = typeof fetch

type StravaErrorBody = {
  message?: string
  errors?: Array<{ resource?: string; field?: string; code?: string }>
}

/** Turn Strava's `{ message, errors[] }` into a single readable string. */
export function formatStravaApiError(
  status: number,
  body: StravaErrorBody,
  fallback: string,
): string {
  const parts: string[] = []
  if (typeof body.message === 'string' && body.message.trim()) {
    parts.push(body.message.trim())
  }
  if (Array.isArray(body.errors)) {
    for (const err of body.errors) {
      const detail = [err.resource, err.field, err.code]
        .filter((p): p is string => Boolean(p && String(p).trim()))
        .join(' ')
      if (detail) parts.push(detail)
    }
  }
  if (parts.length === 0) return `${fallback} (${status})`

  const text = parts.join(' — ')
  const inactive =
    body.errors?.some(
      (e) =>
        e.resource === 'Application' &&
        e.field === 'Status' &&
        e.code === 'Inactive',
    ) ?? false
  if (inactive) {
    return `${text}. Your Strava API app is Inactive — open https://www.strava.com/settings/api while subscribed and reactivate it (Standard Tier requires an active Strava subscription).`
  }
  return text
}

function athleteDisplayName(
  athlete: StravaTokenResponse['athlete'],
): string | null {
  if (!athlete) return null
  const parts = [athlete.firstname, athlete.lastname].filter(
    (p): p is string => Boolean(p && p.trim()),
  )
  if (parts.length > 0) return parts.join(' ')
  if (athlete.username) return athlete.username
  return null
}

export async function exchangeAuthorizationCode(
  fetchImpl: StravaFetch,
  input: {
    clientId: string
    clientSecret: string
    code: string
  },
): Promise<StravaTokenResponse> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code: input.code,
    grant_type: 'authorization_code',
  })
  const res = await fetchImpl('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = (await res.json()) as StravaTokenResponse & StravaErrorBody
  if (!res.ok) {
    throw new Error(
      formatStravaApiError(res.status, json, 'Strava token exchange failed'),
    )
  }
  if (!json.access_token || !json.refresh_token || !json.expires_at) {
    throw new Error('Strava token response missing fields')
  }
  return json
}

export async function refreshAccessToken(
  fetchImpl: StravaFetch,
  input: {
    clientId: string
    clientSecret: string
    refreshToken: string
  },
): Promise<StravaTokenResponse> {
  const body = new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    refresh_token: input.refreshToken,
    grant_type: 'refresh_token',
  })
  const res = await fetchImpl('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const json = (await res.json()) as StravaTokenResponse & StravaErrorBody
  if (!res.ok) {
    throw new Error(
      formatStravaApiError(res.status, json, 'Strava token refresh failed'),
    )
  }
  if (!json.access_token || !json.refresh_token || !json.expires_at) {
    throw new Error('Strava refresh response missing fields')
  }
  return json
}

export async function uploadActivityFit(
  fetchImpl: StravaFetch,
  input: {
    accessToken: string
    fitBytes: Uint8Array
    filename: string
    name?: string
  },
): Promise<StravaUploadResponse> {
  const form = new FormData()
  const copy = new Uint8Array(input.fitBytes.byteLength)
  copy.set(input.fitBytes)
  form.append(
    'file',
    new Blob([copy], { type: 'application/octet-stream' }),
    input.filename,
  )
  form.append('data_type', 'fit')
  form.append('sport_type', 'VirtualRide')
  form.append('trainer', '1')
  if (input.name) form.append('name', input.name)

  const res = await fetchImpl('https://www.strava.com/api/v3/uploads', {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.accessToken}` },
    body: form,
  })
  const json = (await res.json()) as StravaUploadResponse & StravaErrorBody
  if (!res.ok) {
    throw new Error(
      formatStravaApiError(res.status, json, 'Strava upload failed'),
    )
  }
  if (typeof json.id !== 'number') {
    throw new Error('Strava upload response missing id')
  }
  return json
}

export function buildAuthorizeUrl(input: {
  clientId: string
  redirectUri: string
  state: string
  scope?: string
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    response_type: 'code',
    redirect_uri: input.redirectUri,
    approval_prompt: 'auto',
    scope: input.scope ?? 'activity:write',
    state: input.state,
  })
  return `https://www.strava.com/oauth/authorize?${params.toString()}`
}

export { athleteDisplayName }
