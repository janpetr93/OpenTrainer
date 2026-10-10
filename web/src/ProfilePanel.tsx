import { useCallback, useEffect, useState } from 'react'
import {
  beginStravaAuthorize,
  companionHealthy,
  disconnectStrava,
  getRiderProfile,
  getStravaStatus,
  type RiderProfile,
  type StravaLinkStatus,
} from './api'

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

/** Profile tab — read-only Rider Profile (FTP / zones / Training Intent) + Strava Link. */
export function ProfilePanel({ onProfileChange }: Props) {
  const [healthy, setHealthy] = useState<boolean | null>(null)
  const [profile, setProfile] = useState<RiderProfile | null>(null)
  const [strava, setStrava] = useState<StravaLinkStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [stravaMessage, setStravaMessage] = useState<string | null>(() =>
    readStravaQueryMessage(),
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
    const [next, link] = await Promise.all([
      getRiderProfile(),
      getStravaStatus(),
    ])
    applyProfile(next)
    setStrava(link)
  }, [applyProfile])

  useEffect(() => {
    if (stravaMessage) clearStravaQuery()
    void refresh()
  }, [refresh, stravaMessage])

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

  return (
    <div className="profile-panel">
      <header className="live-header">
        <h1>Profile</h1>
        <p className="connection-state">
          Local Companion:{' '}
          {healthy === null ? 'checking…' : healthy ? 'online' : 'offline'}
        </p>
      </header>

      {error && <p className="banner error">{error}</p>}

      <section className="panel-block">
        <h2>Rider Profile · FTP</h2>
        <p className="muted">
          Coggan Power Zones derive from FTP. Set or change FTP via MCP (
          <code>set_ftp</code>). Zone / %FTP workouts resolve when you ride.
        </p>
        <div className="form-row">
          <p aria-label="FTP watts">
            {profile?.ftpWatts != null
              ? `FTP ${profile.ftpWatts} W`
              : 'FTP not set'}
          </p>
          <button type="button" disabled={busy} onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
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
