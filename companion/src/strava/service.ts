import { randomBytes } from 'node:crypto'
import type { LocalStore } from '../store/localStore.js'
import type { ActivityStravaUpload, StravaLink } from '../domain/types.js'
import { oauthResultUrl } from '../oauthHandoff.js'
import type { StravaConfig } from './config.js'
import {
  athleteDisplayName,
  buildAuthorizeUrl,
  exchangeAuthorizationCode,
  refreshAccessToken,
  uploadActivityFit,
  type StravaFetch,
} from './client.js'

const STATE_TTL_MS = 15 * 60 * 1000
const REFRESH_SKEW_SEC = 120

export type StravaLinkStatus = {
  configured: boolean
  linked: boolean
  athleteName: string | null
  athleteId: number | null
  scope: string | null
}

export type StravaServiceOptions = {
  store: LocalStore
  config: StravaConfig | null
  companionOrigin: string
  webOrigin: string
  fetchImpl?: StravaFetch
  now?: () => number
  /** Desktop only. Called after OAuth state is accepted, to stamp the return URL. */
  issueOAuthHandoff?: () => string
}

export class StravaLinkService {
  private readonly store: LocalStore
  private readonly config: StravaConfig | null
  private readonly companionOrigin: string
  private readonly webOrigin: string
  private readonly fetchImpl: StravaFetch
  private readonly now: () => number
  private readonly issueOAuthHandoff: (() => string) | undefined
  private readonly oauthStates = new Map<string, number>()

  constructor(options: StravaServiceOptions) {
    this.store = options.store
    this.config = options.config
    this.companionOrigin = options.companionOrigin.replace(/\/$/, '')
    this.webOrigin = options.webOrigin.replace(/\/$/, '')
    this.fetchImpl = options.fetchImpl ?? fetch
    this.now = options.now ?? Date.now
    this.issueOAuthHandoff = options.issueOAuthHandoff
  }

  get redirectUri(): string {
    return `${this.companionOrigin}/api/strava/callback`
  }

  async getStatus(): Promise<StravaLinkStatus> {
    const link = await this.store.getStravaLink()
    return {
      configured: this.config !== null,
      linked: link !== null,
      athleteName: link?.athleteName ?? null,
      athleteId: link?.athleteId ?? null,
      scope: link?.scope ?? null,
    }
  }

  beginAuthorize(): { url: string } {
    if (!this.config) {
      throw new Error(
        'Strava is not configured. Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in companion/.env',
      )
    }
    this.pruneStates()
    const state = randomBytes(16).toString('hex')
    this.oauthStates.set(state, this.now() + STATE_TTL_MS)
    return {
      url: buildAuthorizeUrl({
        clientId: this.config.clientId,
        redirectUri: this.redirectUri,
        state,
      }),
    }
  }

  async completeOAuth(input: {
    code: string | null
    state: string | null
    scope: string | null
    error: string | null
  }): Promise<string> {
    if (!this.config) {
      return this.resultUrl({ strava: 'error', message: 'Strava not configured' }, false)
    }
    if (!this.consumeState(input.state)) {
      return this.resultUrl(
        { strava: 'error', message: 'Invalid or expired OAuth state' },
        false,
      )
    }
    if (input.error) {
      return this.resultUrl({ strava: 'error', message: input.error }, true)
    }
    if (!input.code) {
      return this.resultUrl({ strava: 'error', message: 'Missing OAuth code' }, true)
    }

    try {
      const token = await exchangeAuthorizationCode(this.fetchImpl, {
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        code: input.code,
      })
      if (!token.athlete?.id) {
        throw new Error('Strava token response missing athlete')
      }
      const scope = input.scope ?? 'activity:write'
      if (!scope.split(/[\s,]+/).includes('activity:write')) {
        return this.resultUrl(
          { strava: 'error', message: 'activity:write scope is required' },
          true,
        )
      }

      const link: StravaLink = {
        schemaVersion: 1,
        athleteId: token.athlete.id,
        athleteName: athleteDisplayName(token.athlete),
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: token.expires_at,
        scope,
        updatedAt: new Date(this.now()).toISOString(),
      }
      await this.store.saveStravaLink(link)
      return this.resultUrl({ strava: 'linked' }, true)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return this.resultUrl({ strava: 'error', message }, true)
    }
  }

  /** True when `state` matches a beginAuthorize call that has not expired. */
  private consumeState(state: string | null): boolean {
    if (!state) return false
    const expires = this.oauthStates.get(state)
    this.oauthStates.delete(state)
    return expires !== undefined && expires >= this.now()
  }

  private resultUrl(params: Record<string, string>, trusted: boolean): string {
    return oauthResultUrl(
      this.webOrigin,
      params,
      trusted ? this.issueOAuthHandoff : undefined,
    )
  }

  async disconnect(): Promise<void> {
    await this.store.clearStravaLink()
  }

  async uploadActivity(input: {
    activityId: string
    fitBase64: string
    name?: string
    description?: string
    force?: boolean
  }): Promise<{
    uploadId: number
    stravaActivityId: number | null
    activity: Awaited<ReturnType<LocalStore['getActivity']>>
  }> {
    if (!this.config) {
      throw new Error(
        'Strava is not configured. Set STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET in companion/.env',
      )
    }
    const activity = await this.store.getActivity(input.activityId)
    if (!activity) {
      throw new Error('Activity not found')
    }
    if (activity.stravaUpload && !input.force) {
      throw new Error(
        'Activity already uploaded to Strava. Pass force=true to upload again.',
      )
    }

    const fitBytes = Buffer.from(input.fitBase64, 'base64')
    if (fitBytes.byteLength === 0) {
      throw new Error('fitBase64 is empty')
    }

    const accessToken = await this.ensureAccessToken()
    const filename = `d100-${activity.id}.fit`
    const upload = await uploadActivityFit(this.fetchImpl, {
      accessToken,
      fitBytes,
      filename,
      name: input.name,
      description: input.description,
    })

    const record: ActivityStravaUpload = {
      uploadId: upload.id,
      stravaActivityId:
        typeof upload.activity_id === 'number' ? upload.activity_id : null,
      uploadedAt: new Date(this.now()).toISOString(),
    }
    const updated = await this.store.setActivityStravaUpload(activity.id, record)
    return {
      uploadId: record.uploadId,
      stravaActivityId: record.stravaActivityId,
      activity: updated,
    }
  }

  private async ensureAccessToken(): Promise<string> {
    if (!this.config) {
      throw new Error('Strava is not configured')
    }
    const link = await this.store.getStravaLink()
    if (!link) {
      throw new Error('Strava Link not connected. Authorize Strava first.')
    }
    const nowSec = Math.floor(this.now() / 1000)
    if (link.expiresAt > nowSec + REFRESH_SKEW_SEC) {
      return link.accessToken
    }
    const refreshed = await refreshAccessToken(this.fetchImpl, {
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      refreshToken: link.refreshToken,
    })
    const next: StravaLink = {
      ...link,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: refreshed.expires_at,
      updatedAt: new Date(this.now()).toISOString(),
      athleteName:
        athleteDisplayName(refreshed.athlete) ?? link.athleteName,
      athleteId: refreshed.athlete?.id ?? link.athleteId,
    }
    await this.store.saveStravaLink(next)
    return next.accessToken
  }

  private pruneStates(): void {
    const t = this.now()
    for (const [state, expires] of this.oauthStates) {
      if (expires < t) this.oauthStates.delete(state)
    }
  }
}
