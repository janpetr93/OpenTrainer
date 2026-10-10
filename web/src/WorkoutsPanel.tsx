import { useCallback, useEffect, useState } from 'react'
import {
  companionHealthy,
  listActivities,
  type Activity,
} from './api'
import { ActivityActions } from './ActivityActions'
import { PowerProfileLine } from './PowerProfileLine'

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s === 0 ? `${m}m` : `${m}m ${s}s`
}

function activitySummary(activity: Activity): string {
  const parts = [formatDuration(activity.durationSec)]
  if (activity.averagePowerWatts !== null) {
    parts.push(`avg ${activity.averagePowerWatts} W`)
  }
  if (activity.maxPowerWatts !== null) {
    parts.push(`max ${activity.maxPowerWatts} W`)
  }
  parts.push(activity.plannedPowerProfile ? 'vs plan' : 'free ride')
  return parts.join(' · ')
}

/** History tab — Activity list (export / Strava / Schedule again). */
export function WorkoutsPanel() {
  const [healthy, setHealthy] = useState<boolean | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const ok = await companionHealthy()
    setHealthy(ok)
    if (!ok) {
      setError('Local Companion not reachable. Run: cd companion && npm run dev')
      return
    }
    setError(null)
    setActivities(await listActivities({ pastDays: 14 }))
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="workouts-panel">
      <header className="live-header">
        <h1>History</h1>
        <p className="connection-state">
          Local Companion:{' '}
          {healthy === null ? 'checking…' : healthy ? 'online' : 'offline'}
        </p>
      </header>

      {error && <p className="banner error">{error}</p>}

      <section className="panel-block">
        <div className="form-row">
          <h2 style={{ flex: 1, margin: 0 }}>
            Activities · last 14 days ({activities.length})
          </h2>
          <button type="button" onClick={() => void refresh()}>
            Refresh
          </button>
        </div>
        <p className="muted">
          Past rides from the Local Store. Plan next week via ChatGPT/MCP, or
          Schedule again on a ride that followed a Workout.
        </p>
        {activities.length === 0 ? (
          <p className="muted">
            Empty until you finish a ride on the Ride tab. MCP{' '}
            <code>list_activities</code> reads this same list.
          </p>
        ) : (
          <ul className="entity-list">
            {activities.map((activity) => (
              <li key={activity.id} className="workout-row">
                <div className="workout-row-meta activity-row-meta">
                  <div>
                    <strong>
                      {new Date(activity.startedAt).toLocaleString()}
                    </strong>
                    <span className="muted">{activitySummary(activity)}</span>
                  </div>
                  <ActivityActions
                    activity={activity}
                    onScheduled={() => void refresh()}
                    onActivityUpdate={(updated) => {
                      setActivities((prev) =>
                        prev.map((a) => (a.id === updated.id ? updated : a)),
                      )
                    }}
                  />
                </div>
                {(activity.achievedPowerProfile.length >= 2 ||
                  (activity.plannedPowerProfile?.length ?? 0) >= 2) && (
                  <>
                    <PowerProfileLine
                      className="power-profile-line"
                      label={`Activity ${activity.id}`}
                      height={72}
                      series={[
                        ...(activity.plannedPowerProfile &&
                        activity.plannedPowerProfile.length >= 2
                          ? [
                              {
                                points: activity.plannedPowerProfile,
                                tone: 'planned' as const,
                              },
                            ]
                          : []),
                        ...(activity.achievedPowerProfile.length >= 2
                          ? [
                              {
                                points: activity.achievedPowerProfile,
                                tone: 'achieved' as const,
                              },
                            ]
                          : []),
                      ]}
                    />
                    <p className="chart-legend muted">
                      {activity.plannedPowerProfile &&
                        activity.plannedPowerProfile.length >= 2 && (
                          <span className="legend-planned">Plan</span>
                        )}
                      {activity.achievedPowerProfile.length >= 2 && (
                        <span className="legend-achieved">Achieved</span>
                      )}
                    </p>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
