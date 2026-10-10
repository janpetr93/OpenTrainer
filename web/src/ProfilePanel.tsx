import { useCallback, useEffect, useState } from 'react'
import {
  beginStravaAuthorize,
  companionHealthy,
  disconnectStrava,
  getRiderProfile,
  getStravaStatus,
  setFtp,
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

/** Profile tab — Rider Profile (FTP / zones) + Strava Link. */
export function ProfilePanel({ onProfileChange }: Props) {
  const [healthy, setHealthy] = useState<boolean | null>(null)
  const [profile, setProfile] = useState<RiderProfile | null>(null)
  const [strava, setStrava] = useState<StravaLinkStatus | null>(null)
  const [ftpInput, setFtpInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [stravaMessage, setStravaMessage] = useState<string | null>(() =>
    readStravaQueryMessage(),
  )
  const [busy, setBusy] = useState(false)

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
    setProfile(next)
    setStrava(link)
    setFtpInput(next.ftpWatts !== null ? String(next.ftpWatts) : '')
    onProfileChange?.(next)
  }, [onProfileChange])

  useEffect(() => {
    if (stravaMessage) clearStravaQuery()
    void refresh()
  }, [refresh, stravaMessage])

  async function onSave(): Promise<void> {
    const value = Number(ftpInput)
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a positive FTP in watts')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const next = await setFtp(value)
      setProfile(next)
      setFtpInput(String(next.ftpWatts))
      onProfileChange?.(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

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
          Coggan Power Zones derive from FTP. Zone / %FTP workouts resolve when
          you ride.
        </p>
        <div className="form-row">
          <input
            type="number"
            min={1}
            max={2000}
            value={ftpInput}
            onChange={(e) => setFtpInput(e.target.value)}
            placeholder="FTP watts"
            aria-label="FTP watts"
            disabled={healthy === false}
          />
          <button
            type="button"
            className="primary"
            disabled={busy || healthy === false}
            onClick={() => void onSave()}
          >
            Save FTP
          </button>
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
            No FTP set yet — absolute-watts workouts still work.
          </p>
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
