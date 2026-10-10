import { useCallback, useEffect, useState } from 'react'
import {
  companionHealthy,
  listActivities,
  listWorkouts,
  type Activity,
  type Workout,
} from './api'
import { ActivityActions } from './ActivityActions'
import { PageHeader } from './PageHeader'
import { SessionModule } from './SessionModule'
import {
  activityMeta,
  chartFromActivity,
  sessionTitle,
} from './session/sessionModuleHelpers'

/** History tab — Activity list (export / Strava / Schedule again). */
export function WorkoutsPanel() {
  const [healthy, setHealthy] = useState<boolean | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const ok = await companionHealthy()
    setHealthy(ok)
    if (!ok) {
      setError('Local Companion not reachable. Run: cd companion && npm run dev')
      return
    }
    setError(null)
    const [a, w] = await Promise.all([
      listActivities({ pastDays: 14 }),
      listWorkouts(),
    ])
    setActivities(a)
    setWorkouts(w)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const workoutName = useCallback(
    (id: string | null) =>
      id ? (workouts.find((w) => w.id === id)?.name ?? null) : null,
    [workouts],
  )

  return (
    <div className="workouts-panel">
      <PageHeader
        title="History"
        status={
          <p className="connection-state">
            Local Companion:{' '}
            {healthy === null ? 'checking…' : healthy ? 'online' : 'offline'}
          </p>
        }
        blurb="Past rides from the Local Store. Plan next week via ChatGPT/MCP, or Schedule again on a ride that followed a Workout."
      />

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
        {activities.length === 0 ? (
          <p className="muted">
            Empty until you finish a ride on the Ride tab. MCP{' '}
            <code>list_activities</code> reads this same list.
          </p>
        ) : (
          <ul className="entity-list">
            {activities.map((activity) => {
              const chart = chartFromActivity(activity)
              return (
                <SessionModule
                  key={activity.id}
                  title={sessionTitle(
                    workoutName(activity.workoutId),
                    'activity',
                  )}
                  meta={activityMeta(activity)}
                  purpose={activity.purpose}
                  chartLabel={`Activity ${activity.id}`}
                  series={chart.series}
                  showLegend={chart.showLegend}
                  actions={
                    <ActivityActions
                      activity={activity}
                      onScheduled={() => void refresh()}
                      onActivityUpdate={(updated) => {
                        setActivities((prev) =>
                          prev.map((a) => (a.id === updated.id ? updated : a)),
                        )
                      }}
                    />
                  }
                />
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
