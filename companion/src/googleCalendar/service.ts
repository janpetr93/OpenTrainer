import { randomBytes } from 'node:crypto'
import { workoutDurationSec } from '../domain/workoutItems.js'
import type { LocalStore } from '../store/localStore.js'
import type {
  GoogleCalendarLink,
  ScheduledRideView,
  Workout,
} from '../domain/types.js'
import type { GoogleCalendarConfig } from './config.js'
import {
  buildAuthorizeUrl,
  createCalendar,
  deleteEvent,
  exchangeAuthorizationCode,
  getCalendar,
  hasCalendarScope,
  insertEvent,
  patchEvent,
  refreshAccessToken,
  type GoogleEventBody,
  type GoogleFetch,
} from './client.js'

const STATE_TTL_MS = 15 * 60 * 1000
const REFRESH_SKEW_SEC = 120

export type CalendarMirrorStatus = {
  configured: boolean
  linked: boolean
  calendarId: string | null
  lastError: string | null
}

export type CalendarMirrorOptions = {
  store: LocalStore
  config: GoogleCalendarConfig | null
  companionOrigin: string
  webOrigin: string
  fetchImpl?: GoogleFetch
  now?: () => number
}

export class CalendarMirror {
  private readonly store: LocalStore
  private readonly config: GoogleCalendarConfig | null
  private readonly companionOrigin: string
  private readonly webOrigin: string
  private readonly fetchImpl: GoogleFetch
  private readonly now: () => number
  private readonly oauthStates = new Map<string, number>()

  constructor(options: CalendarMirrorOptions) {
    this.store = options.store
    this.config = options.config
    this.companionOrigin = options.companionOrigin.replace(/\/$/, '')
    this.webOrigin = options.webOrigin.replace(/\/$/, '')
    this.fetchImpl = options.fetchImpl ?? fetch
    this.now = options.now ?? Date.now
  }

  get redirectUri(): string {
    return `${this.companionOrigin}/api/google-calendar/callback`
  }

  async getStatus(): Promise<CalendarMirrorStatus> {
    const link = await this.store.getGoogleCalendarLink()
    return {
      configured: this.config !== null,
      linked: Boolean(link?.refreshToken),
      calendarId: link?.calendarId ?? null,
      lastError: link?.lastError ?? null,
    }
  }

  beginAuthorize(): { url: string } {
    if (!this.config) {
      throw new Error(
        'Google Calendar is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in companion/.env',
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
    const returnBase = `${this.webOrigin}/?`
    if (input.error) {
      return `${returnBase}googleCalendar=error&message=${encodeURIComponent(input.error)}`
    }
    if (!this.config) {
      return `${returnBase}googleCalendar=error&message=${encodeURIComponent('Google Calendar not configured')}`
    }
    if (!input.code || !input.state) {
      return `${returnBase}googleCalendar=error&message=${encodeURIComponent('Missing OAuth code')}`
    }
    const expires = this.oauthStates.get(input.state)
    this.oauthStates.delete(input.state)
    if (expires === undefined || expires < this.now()) {
      return `${returnBase}googleCalendar=error&message=${encodeURIComponent('Invalid or expired OAuth state')}`
    }

    try {
      const token = await exchangeAuthorizationCode(this.fetchImpl, {
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
        code: input.code,
        redirectUri: this.redirectUri,
      })
      if (!token.refresh_token) {
        throw new Error('Google token response missing refresh_token')
      }
      const scope = token.scope ?? input.scope ?? ''
      if (!hasCalendarScope(scope)) {
        return `${returnBase}googleCalendar=error&message=${encodeURIComponent('calendar.app.created scope is required')}`
      }
      const existing = await this.store.getGoogleCalendarLink()
      const link: GoogleCalendarLink = {
        schemaVersion: 1,
        calendarId: existing?.calendarId ?? null,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Math.floor(this.now() / 1000) + token.expires_in,
        scope,
        updatedAt: new Date(this.now()).toISOString(),
        lastError: null,
      }
      await this.store.saveGoogleCalendarLink(link)
      await this.reconcile()
      return `${returnBase}googleCalendar=linked`
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return `${returnBase}googleCalendar=error&message=${encodeURIComponent(message)}`
    }
  }

  /** Drop tokens on this laptop. The OpenTrainer calendar stays in Google. */
  async disconnect(): Promise<void> {
    const link = await this.store.getGoogleCalendarLink()
    if (!link) return
    await this.store.saveGoogleCalendarLink({
      ...link,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      scope: null,
      lastError: null,
      updatedAt: new Date(this.now()).toISOString(),
    })
  }

  /**
   * Push Scheduled Ride changes to Google. Never throws: a Google failure
   * is stored on the link as lastError so the local write still stands.
   */
  async reconcile(): Promise<void> {
    if (!this.config) return
    const link = await this.store.getGoogleCalendarLink()
    if (!link?.refreshToken) return
    try {
      const accessToken = await this.ensureAccessToken()
      const calendarId = await this.ensureCalendar(accessToken)
      await this.syncRides(accessToken, calendarId)
      await this.setLastError(null)
    } catch (error) {
      await this.setLastError(
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  private async syncRides(
    accessToken: string,
    calendarId: string,
  ): Promise<void> {
    const rides = await this.store.listScheduledRides()
    const index = await this.store.getGoogleCalendarEventIndex()
    const next: Record<string, string> = { ...index.byRideId }
    const byId = new Map(rides.map((ride) => [ride.id, ride]))
    let failure: string | null = null
    const todayStart = startOfLocalDay(this.now())

    for (const [rideId, eventId] of Object.entries(index.byRideId)) {
      const ride = byId.get(rideId)
      if (!ride || ride.status === 'skipped') {
        try {
          await deleteEvent(this.fetchImpl, {
            accessToken,
            calendarId,
            eventId,
          })
          delete next[rideId]
        } catch (error) {
          failure = errorMessage(error)
        }
        continue
      }
      if (ride.status === 'completed') continue
      try {
        const eventIdAfter = await this.upsertPlanned(
          accessToken,
          calendarId,
          ride,
          eventId,
        )
        next[rideId] = eventIdAfter
      } catch (error) {
        failure = errorMessage(error)
      }
    }

    for (const ride of rides) {
      if (ride.status !== 'planned') continue
      if (next[ride.id]) continue
      if (Date.parse(ride.startsAt) < todayStart) continue
      try {
        const eventId = await this.upsertPlanned(
          accessToken,
          calendarId,
          ride,
          null,
        )
        next[ride.id] = eventId
      } catch (error) {
        failure = errorMessage(error)
      }
    }

    await this.store.saveGoogleCalendarEventIndex({
      schemaVersion: 1,
      byRideId: next,
    })
    if (failure) throw new Error(failure)
  }

  private async upsertPlanned(
    accessToken: string,
    calendarId: string,
    ride: ScheduledRideView,
    eventId: string | null,
  ): Promise<string> {
    const workout = await this.store.getWorkout(ride.workoutId)
    if (!workout) throw new Error(`Workout not found: ${ride.workoutId}`)
    const event = eventBody(ride, workout)
    if (eventId) {
      const patched = await patchEvent(this.fetchImpl, {
        accessToken,
        calendarId,
        eventId,
        event,
      })
      if (patched === 'updated') return eventId
    }
    const created = await insertEvent(this.fetchImpl, {
      accessToken,
      calendarId,
      event,
    })
    return created.id
  }

  private async ensureCalendar(accessToken: string): Promise<string> {
    const link = await this.store.getGoogleCalendarLink()
    if (!link) throw new Error('Google Calendar not connected')
    if (link.calendarId) {
      const exists = await getCalendar(this.fetchImpl, {
        accessToken,
        calendarId: link.calendarId,
      })
      if (exists) return link.calendarId
    }
    const created = await createCalendar(this.fetchImpl, { accessToken })
    const current = await this.store.getGoogleCalendarLink()
    if (!current) throw new Error('Google Calendar not connected')
    await this.store.saveGoogleCalendarLink({
      ...current,
      calendarId: created.id,
      updatedAt: new Date(this.now()).toISOString(),
    })
    await this.store.saveGoogleCalendarEventIndex({
      schemaVersion: 1,
      byRideId: {},
    })
    return created.id
  }

  private async ensureAccessToken(): Promise<string> {
    if (!this.config) throw new Error('Google Calendar is not configured')
    const link = await this.store.getGoogleCalendarLink()
    if (!link?.refreshToken || !link.accessToken || link.expiresAt === null) {
      throw new Error('Google Calendar is not connected. Authorize on Profile first.')
    }
    const nowSec = Math.floor(this.now() / 1000)
    if (link.expiresAt > nowSec + REFRESH_SKEW_SEC) return link.accessToken
    const refreshed = await refreshAccessToken(this.fetchImpl, {
      clientId: this.config.clientId,
      clientSecret: this.config.clientSecret,
      refreshToken: link.refreshToken,
    })
    const accessToken = refreshed.access_token
    const next: GoogleCalendarLink = {
      ...link,
      accessToken,
      refreshToken: refreshed.refresh_token ?? link.refreshToken,
      expiresAt: nowSec + refreshed.expires_in,
      scope: refreshed.scope ?? link.scope,
      updatedAt: new Date(this.now()).toISOString(),
    }
    await this.store.saveGoogleCalendarLink(next)
    return accessToken
  }

  private async setLastError(message: string | null): Promise<void> {
    const link = await this.store.getGoogleCalendarLink()
    if (!link || link.lastError === message) return
    await this.store.saveGoogleCalendarLink({
      ...link,
      lastError: message,
      updatedAt: new Date(this.now()).toISOString(),
    })
  }

  private pruneStates(): void {
    const t = this.now()
    for (const [state, expires] of this.oauthStates) {
      if (expires < t) this.oauthStates.delete(state)
    }
  }
}

export function startOfLocalDay(nowMs: number): number {
  const day = new Date(nowMs)
  day.setHours(0, 0, 0, 0)
  return day.getTime()
}

function eventBody(ride: ScheduledRideView, workout: Workout): GoogleEventBody {
  const startMs = Date.parse(ride.startsAt)
  const durationSec = workoutDurationSec(workout.steps)
  return {
    summary: workout.name,
    description: ride.purpose ?? '',
    start: { dateTime: new Date(startMs).toISOString() },
    end: { dateTime: new Date(startMs + durationSec * 1000).toISOString() },
    reminders: { useDefault: false },
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
