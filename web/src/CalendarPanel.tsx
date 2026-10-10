import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  companionHealthy,
  deleteScheduledRide,
  getRiderProfile,
  listActivities,
  listScheduledRides,
  listWorkouts,
  skipScheduledRide,
  type Activity,
  type ScheduledRide,
  type Workout,
} from './api'
import { dayKey, monthCells, monthRangeIso } from './calendar/monthGrid'
import { ActivityActions } from './ActivityActions'
import { PageHeader } from './PageHeader'
import { SessionModule } from './SessionModule'
import {
  activityMeta,
  chartFromActivity,
  chartFromScheduledWorkout,
  scheduledDurationLabel,
  scheduledMeta,
  scheduledOutcomeLabel,
  sessionTitle,
} from './session/sessionModuleHelpers'

type Props = {
  onStartScheduledWorkout: (
    workoutId: string,
    purpose?: string | null,
    scheduledRideId?: string | null,
  ) => void
}

export function CalendarPanel({ onStartScheduledWorkout }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [monthIndex, setMonthIndex] = useState(now.getMonth())
  const [selectedKey, setSelectedKey] = useState(dayKey(now))
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [scheduled, setScheduled] = useState<ScheduledRide[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [ftpWatts, setFtpWatts] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [healthy, setHealthy] = useState<boolean | null>(null)

  const cells = useMemo(
    () => monthCells(year, monthIndex),
    [year, monthIndex],
  )

  const workoutName = useCallback(
    (id: string) => workouts.find((w) => w.id === id)?.name ?? 'Workout',
    [workouts],
  )

  const refresh = useCallback(async () => {
    const ok = await companionHealthy()
    setHealthy(ok)
    if (!ok) {
      setError('Local Companion not reachable.')
      return
    }
    setError(null)
    const range = monthRangeIso(year, monthIndex)
    const [w, s, a, profile] = await Promise.all([
      listWorkouts(),
      listScheduledRides(range),
      listActivities(range),
      getRiderProfile(),
    ])
    setWorkouts(w)
    setScheduled(s)
    setActivities(a)
    setFtpWatts(profile.ftpWatts)
  }, [year, monthIndex])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const scheduledByDay = useMemo(() => {
    const map = new Map<string, ScheduledRide[]>()
    for (const ride of scheduled) {
      const key = dayKey(new Date(ride.startsAt))
      const list = map.get(key) ?? []
      list.push(ride)
      map.set(key, list)
    }
    return map
  }, [scheduled])

  const activitiesByDay = useMemo(() => {
    const map = new Map<string, Activity[]>()
    for (const activity of activities) {
      const key = dayKey(new Date(activity.startedAt))
      const list = map.get(key) ?? []
      list.push(activity)
      map.set(key, list)
    }
    return map
  }, [activities])

  const selectedScheduled = scheduledByDay.get(selectedKey) ?? []
  const selectedActivities = activitiesByDay.get(selectedKey) ?? []

  function shiftMonth(delta: number): void {
    const d = new Date(year, monthIndex + delta, 1)
    setYear(d.getFullYear())
    setMonthIndex(d.getMonth())
  }

  async function onDelete(id: string): Promise<void> {
    try {
      await deleteScheduledRide(id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function onSkip(id: string): Promise<void> {
    try {
      await skipScheduledRide(id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const monthLabel = new Date(year, monthIndex, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="calendar-panel">
      <PageHeader
        title="Calendar"
        status={
          <p className="connection-state">
            Local Companion:{' '}
            {healthy === null ? 'checking…' : healthy ? 'online' : 'offline'}
          </p>
        }
        blurb={
          <>
            New rides come from ChatGPT/MCP week planning, or{' '}
            <strong>Schedule again</strong> on a past Activity below / on
            History. No workout catalog here.
          </>
        }
      />

      {error && <p className="banner error">{error}</p>}

      <section className="panel-block">
        <div className="calendar-month">
          <div className="calendar-nav">
            <button type="button" onClick={() => shiftMonth(-1)}>
              ←
            </button>
            <h2>{monthLabel}</h2>
            <button type="button" onClick={() => shiftMonth(1)}>
              →
            </button>
          </div>

          <div className="calendar-weekdays" aria-hidden="true">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {cells.map((cell, index) => {
              if (!cell) {
                return <div key={`pad-${index}`} className="cal-cell empty" />
              }
              const key = dayKey(cell)
              const hasSched = (scheduledByDay.get(key)?.length ?? 0) > 0
              const hasAct = (activitiesByDay.get(key)?.length ?? 0) > 0
              const selected = key === selectedKey
              const today = key === dayKey(new Date())
              return (
                <button
                  key={key}
                  type="button"
                  className={[
                    'cal-cell',
                    selected ? 'selected' : '',
                    today ? 'today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => setSelectedKey(key)}
                >
                  <span className="cal-daynum">{cell.getDate()}</span>
                  <span className="cal-markers">
                    {hasSched && (
                      <span className="mark sched" title="Scheduled" />
                    )}
                    {hasAct && <span className="mark done" title="Activity" />}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="muted cal-legend">
            <span className="mark sched" /> Scheduled ·{' '}
            <span className="mark done" /> Completed Activity
          </p>
        </div>
      </section>

      <section className="panel-block calendar-day-panel">
        <h2>{selectedKey}</h2>

        <h3 className="cal-section-title">Scheduled</h3>
        {selectedScheduled.length === 0 ? (
          <p className="muted">Nothing scheduled.</p>
        ) : (
          <ul className="entity-list">
            {selectedScheduled.map((ride) => {
              const workout = workouts.find((w) => w.id === ride.workoutId)
              const chart = chartFromScheduledWorkout(workout, ftpWatts)
              const outcome = scheduledOutcomeLabel(ride)
              const startable =
                ride.status !== 'completed' && ride.status !== 'skipped'
              return (
                <SessionModule
                  key={ride.id}
                  title={sessionTitle(workoutName(ride.workoutId), 'scheduled')}
                  meta={scheduledMeta(
                    ride.startsAt,
                    scheduledDurationLabel(workout, ftpWatts),
                    outcome,
                  )}
                  purpose={ride.purpose}
                  chartLabel={`${workoutName(ride.workoutId)} planned Power Profile`}
                  series={chart.series}
                  needsFtpToPreview={chart.needsFtpToPreview}
                  actions={
                    <>
                      {startable ? (
                        <button
                          type="button"
                          className="primary"
                          onClick={() =>
                            onStartScheduledWorkout(
                              ride.workoutId,
                              ride.purpose ?? null,
                              ride.id,
                            )
                          }
                        >
                          Start on Ride
                        </button>
                      ) : null}
                      {startable ? (
                        <button
                          type="button"
                          onClick={() => void onSkip(ride.id)}
                        >
                          Skip
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void onDelete(ride.id)}
                      >
                        Remove
                      </button>
                    </>
                  }
                />
              )
            })}
          </ul>
        )}

        <h3 className="cal-section-title">Activities</h3>
        {selectedActivities.length === 0 ? (
          <p className="muted">No completed rides this day.</p>
        ) : (
          <ul className="entity-list">
            {selectedActivities.map((activity) => {
              const chart = chartFromActivity(activity)
              return (
                <SessionModule
                  key={activity.id}
                  title={sessionTitle(
                    activity.workoutId
                      ? (workouts.find((w) => w.id === activity.workoutId)
                          ?.name ?? null)
                      : null,
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
