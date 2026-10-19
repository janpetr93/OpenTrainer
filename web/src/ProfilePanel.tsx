import { useCallback, useEffect, useState } from 'react'
import {
  beginCalendarMirrorAuthorize,
  beginStravaAuthorize,
  companionHealthy,
  disconnectCalendarMirror,
  disconnectStrava,
  getCalendarMirrorStatus,
  getMmp,
  getRiderProfile,
  getStravaStatus,
  recomputeMmp,
  type CalendarMirrorStatus,
  type MmpView,
  type RiderProfile,
  type StravaLinkStatus,
} from './api'
import { formatMmpDuration } from './mmp/formatDuration'
import { MmpChart } from './mmp/MmpChart'
import { PageHeader } from './PageHeader'

type Props = {
  onProfileChange?: (profile: RiderProfile) => void
}

function readStravaQueryMessage(): string | null {
  const params = new URLSearchParams(window.location.search)
  const flag = params.get('strava')
  if (!flag) return null
  if (flag === 'linked') return 'Strava Link connected.'
  if (flag === 'error') {
    return params.get('message') ?? 'Strava authorization failed.'
  }
  return null
}

function clearStravaQuery(): void {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('strava')) return
  url.searchParams.delete('strava')
  url.searchParams.delete('message')
  window.history.replaceState({}, '', url.pathname + url.search + url.hash)
}

function readCalendarQueryMessage(): string | null {
  const params = new URLSearchParams(window.location.search)
  const flag = params.get('googleCalendar')
  if (!flag) return null
  if (flag === 'linked') return 'Google Calendar connected.'
  if (flag === 'error') {
    return params.get('message') ?? 'Google Calendar authorization failed.'
  }
  return null
}

function clearCalendarQuery(): void {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('googleCalendar')) return
  url.searchParams.delete('googleCalendar')
  url.searchParams.delete('message')
  window.history.replaceState({}, '', url.pathname + url.search + url.hash)
}

/** Profile tab — read-only Rider Profile (FTP / zones / Training Intent) + MMP + Strava Link. */
export function ProfilePanel({ onProfileChange }: Props) {
  const [healthy, setHealthy] = useState<boolean | null>(null)
  const [profile, setProfile] = useState<RiderProfile | null>(null)
  const [mmp, setMmp] = useState<MmpView | null>(null)
  const [strava, setStrava] = useState<StravaLinkStatus | null>(null)
  const [calendarMirror, setCalendarMirror] =
    useState<CalendarMirrorStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stravaMessage, setStravaMessage] = useState<string | null>(() =>
    readStravaQueryMessage(),
  )
  const [calendarMessage, setCalendarMessage] = useState<string | null>(() =>
    readCalendarQueryMessage(),
  )
  const [busy, setBusy] = useState(false)

  const applyProfile = useCallback(
    (next: RiderProfile) => {
      setProfile(next)
      onProfileChange?.(next)
    },
    [onProfileChange],
  )

  const refresh = useCallback(async () => {
    const ok = await companionHealthy()
    setHealthy(ok)
    if (!ok) {
      setError('Local Companion not reachable.')
      return
    }
    setError(null)
    const [next, link, nextMmp, mirror] = await Promise.all([
      getRiderProfile(),
      getStravaStatus(),
      getMmp(),
      getCalendarMirrorStatus(),
    ])
    applyProfile(next)
    setStrava(link)
    setMmp(nextMmp)
    setCalendarMirror(mirror)
  }, [applyProfile])

  useEffect(() => {
    if (stravaMessage) clearStravaQuery()
    if (calendarMessage) clearCalendarQuery()
    void refresh()
  }, [refresh, stravaMessage, calendarMessage])

  async function onDisconnectStrava(): Promise<void> {
    setBusy(true)
    setStravaMessage(null)
    try {
      await disconnectStrava()
      setStrava(await getStravaStatus())
      setStravaMessage('Strava Link disconnected.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function onDisconnectCalendar(): Promise<void> {
    setBusy(true)
    setCalendarMessage(null)
    try {
      await disconnectCalendarMirror()
      setCalendarMirror(await getCalendarMirrorStatus())
      setCalendarMessage(
        'Disconnected. The OpenTrainer calendar stays in Google and stops updating.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function onRecomputeMmp(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      setMmp(await recomputeMmp())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="profile-panel">
      <PageHeader
        title="Profile"
        status={
          <p className="connection-state">
            Local Companion:{' '}
            {healthy === null ? 'checking…' : healthy ? 'online' : 'offline'}
          </p>
        }
        blurb="FTP, power curve, training intent, and optional Strava and Google Calendar links for this Local Store."
      />

      {error && <p className="banner error">{error}</p>}

      <section className="panel-block">
        <h2>Rider Profile · FTP</h2>
        <p className="muted">
          Coggan Power Zones derive from FTP. Set or change FTP via MCP (
          <code>set_ftp</code>). Zone / %FTP workouts resolve when you ride.
        </p>
        <p aria-label="FTP watts">
          {profile?.ftpWatts != null
            ? `FTP ${profile.ftpWatts} W`
            : 'FTP not set'}
        </p>
        {profile?.zones && (
          <ul className="zone-list">
            {profile.zones.map((z) => (
              <li key={z.zone}>
                <strong>Z{z.zone}</strong> {z.name} · {z.minWatts}
                {z.maxWatts === null ? '+' : `–${z.maxWatts}`} W
                <span className="muted"> (target {z.targetWatts} W)</span>
              </li>
            ))}
          </ul>
        )}
        {profile && profile.ftpWatts === null && (
          <p className="muted">
            No FTP set yet — ask your coach via MCP to call <code>set_ftp</code>.
            Absolute-watts workouts still work.
          </p>
        )}
      </section>

      <section className="panel-block">
        <h2>Power curve · Mean Maximal Power</h2>
        <p className="muted">
          Lifetime best averages across all Activities — Power Meter watts when
          recorded, otherwise Trainer. Recompute after new rides (also refreshes
          automatically when an Activity is saved).
        </p>
        {mmp?.stale && (
          <p className="banner mmp-stale" role="status">
            Out of date — Recompute to include recent Activities.
          </p>
        )}
        {mmp && mmp.points.length === 0 && (
          <p className="muted">
            No MMP cache yet. Ride a few sessions, then Recompute.
          </p>
        )}
        {mmp && mmp.points.length > 0 && (
          <>
            <MmpChart points={mmp.points} setFtpWatts={mmp.setFtpWatts} />
            <div className="mmp-estimate">
              {mmp.estimatedFtpWatts != null ? (
                <p>
                  Estimated FTP (20min × 0.95):{' '}
                  <strong>{mmp.estimatedFtpWatts} W</strong>
                  {mmp.setFtpWatts != null ? (
                    <>
                      {' '}
                      vs set <strong>{mmp.setFtpWatts} W</strong>
                      {mmp.estimatedFtpDeltaWatts != null && (
                        <span className="muted">
                          {' '}
                          ({mmp.estimatedFtpDeltaWatts >= 0 ? '+' : ''}
                          {mmp.estimatedFtpDeltaWatts} W)
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="muted"> — set FTP via MCP to compare</span>
                  )}
                </p>
              ) : (
                <p className="muted">
                  Estimated FTP needs a 20min best — not available yet.
                </p>
              )}
            </div>
            <table className="mmp-table">
              <thead>
                <tr>
                  <th scope="col">Duration</th>
                  <th scope="col">Watts</th>
                  <th scope="col">% FTP</th>
                  <th scope="col">Best date</th>
                </tr>
              </thead>
              <tbody>
                {mmp.points.map((p) => (
                  <tr key={p.durationSec}>
                    <td>{formatMmpDuration(p.durationSec)}</td>
                    <td>{p.watts == null ? '—' : `${p.watts}`}</td>
                    <td>{p.percentFtp == null ? '—' : `${p.percentFtp}%`}</td>
                    <td>
                      {p.startedAt
                        ? new Date(p.startedAt).toLocaleDateString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <div className="form-row">
          <button
            type="button"
            className="primary"
            disabled={busy || healthy === false}
            onClick={() => void onRecomputeMmp()}
          >
            Recompute
          </button>
          {mmp?.computedAt && (
            <p className="muted mmp-computed-at">
              Last computed {new Date(mmp.computedAt).toLocaleString()}
            </p>
          )}
        </div>
      </section>

      <section className="panel-block">
        <h2>Training Intent</h2>
        <p className="muted">
          Durable direction for AI week planning. Set or clear via MCP (
          <code>set_training_intent</code>). Recent training emphasis comes from
          Activity history; this week&apos;s availability is asked in chat, not
          stored here.
        </p>
        {profile?.intent ? (
          <dl className="intent-readonly">
            <dt>Goal</dt>
            <dd>{profile.intent.goal}</dd>
            {profile.intent.horizon && (
              <>
                <dt>Horizon</dt>
                <dd>{profile.intent.horizon}</dd>
              </>
            )}
            {profile.intent.note && (
              <>
                <dt>Note</dt>
                <dd>{profile.intent.note}</dd>
              </>
            )}
            {profile.intent.maxHardDaysPerWeek != null && (
              <>
                <dt>Max hard days / week</dt>
                <dd>{profile.intent.maxHardDaysPerWeek}</dd>
              </>
            )}
            {profile.intent.preferredLongRideWeekday != null && (
              <>
                <dt>Preferred long-ride day</dt>
                <dd>
                  {
                    [
                      'Sunday',
                      'Monday',
                      'Tuesday',
                      'Wednesday',
                      'Thursday',
                      'Friday',
                      'Saturday',
                    ][profile.intent.preferredLongRideWeekday]
                  }
                </dd>
              </>
            )}
            {profile.intent.constraintsNote && (
              <>
                <dt>Constraints</dt>
                <dd>{profile.intent.constraintsNote}</dd>
              </>
            )}
          </dl>
        ) : (
          profile && (
            <p className="muted">
              No Intent set — week planning will ask, or set it via MCP (
              <code>set_training_intent</code>).
            </p>
          )
        )}
      </section>

      <section className="panel-block">
        <h2>Google Calendar</h2>
        <p className="muted">
          Copies Scheduled Rides onto an OpenTrainer calendar in your Google
          account. The rides stay there after you quit. Activities are not
          copied. Connect needs a Google Cloud OAuth client in{' '}
          <code>companion/.env</code>.
        </p>
        {calendarMessage && <p className="banner">{calendarMessage}</p>}
        {calendarMirror?.lastError && (
          <p className="banner error">{calendarMirror.lastError}</p>
        )}
        {calendarMirror && !calendarMirror.configured && (
          <p className="muted">
            Not configured — add <code>GOOGLE_CLIENT_ID</code> and{' '}
            <code>GOOGLE_CLIENT_SECRET</code>, then restart the companion.
          </p>
        )}
        {calendarMirror?.configured && calendarMirror.linked && (
          <p>Connected. Planned rides mirror to the OpenTrainer calendar.</p>
        )}
        {calendarMirror?.configured &&
          !calendarMirror.linked &&
          calendarMirror.calendarId && (
            <p className="muted">
              Disconnected. The OpenTrainer calendar is still in Google and is
              not receiving updates.
            </p>
          )}
        <div className="form-row">
          <button
            type="button"
            className="primary"
            disabled={busy || healthy === false || !calendarMirror?.configured}
            onClick={() => beginCalendarMirrorAuthorize()}
          >
            {calendarMirror?.linked
              ? 'Reconnect Google Calendar'
              : 'Connect Google Calendar'}
          </button>
          <button
            type="button"
            disabled={busy || healthy === false || !calendarMirror?.linked}
            onClick={() => void onDisconnectCalendar()}
          >
            Disconnect
          </button>
        </div>
      </section>

      <section className="panel-block">
        <h2>Strava Link</h2>
        <p className="muted">
          Optional one-click Activity upload. Requires a Strava subscription and
          API app credentials in <code>companion/.env</code>. Export FIT still
          works without this.
        </p>
        {stravaMessage && <p className="banner">{stravaMessage}</p>}
        {strava && !strava.configured && (
          <p className="muted">
            Not configured — add <code>STRAVA_CLIENT_ID</code> and{' '}
            <code>STRAVA_CLIENT_SECRET</code>, then restart the companion.
          </p>
        )}
        {strava?.configured && strava.linked && (
          <p>
            Connected
            {strava.athleteName ? ` as ${strava.athleteName}` : ''}
            {strava.athleteId ? ` (#${strava.athleteId})` : ''}.
          </p>
        )}
        <div className="form-row">
          <button
            type="button"
            className="primary"
            disabled={busy || healthy === false || !strava?.configured}
            onClick={() => beginStravaAuthorize()}
          >
            {strava?.linked ? 'Reconnect Strava' : 'Connect Strava'}
          </button>
          <button
            type="button"
            disabled={busy || healthy === false || !strava?.linked}
            onClick={() => void onDisconnectStrava()}
          >
            Disconnect
          </button>
        </div>
      </section>
    </div>
  )
}
