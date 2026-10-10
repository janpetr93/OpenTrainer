import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  clearScheduledRides,
  companionHealthy,
  deleteScheduledRide,
  listActivities,
  listScheduledRides,
  listWorkouts,
  type Activity,
  type ScheduledRide,
  type Workout,
} from './api'
import { dayKey, monthCells, monthRangeIso } from './calendar/monthGrid'
import { ActivityActions } from './ActivityActions'
import { PowerProfileLine } from './PowerProfileLine'

type Props = {
  onStartScheduledWorkout: (workoutId: string) => void
}

export function CalendarPanel({ onStartScheduledWorkout }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [monthIndex, setMonthIndex] = useState(now.getMonth())
  const [selectedKey, setSelectedKey] = useState(dayKey(now))
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [scheduled, setScheduled] = useState<ScheduledRide[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
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
    const [w, s, a] = await Promise.all([
      listWorkouts(),
      listScheduledRides(range),
      listActivities(range),
    ])
    setWorkouts(w)
    setScheduled(s)
    setActivities(a)
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

  const monthLabel = new Date(year, monthIndex, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  async function onClearMonth(): Promise<void> {
    if (
      !window.confirm(
        `Delete all Scheduled Rides in ${monthLabel}? Activities are kept.`,
      )
    ) {
      return
    }
    try {
      const range = monthRangeIso(year, monthIndex)
      await clearScheduledRides(range)
      setError(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="calendar-panel">
      <header className="live-header">
        <h1>Training Calendar</h1>
        <p className="connection-state">
          Local Companion:{' '}
          {healthy === null ? 'checking…' : healthy ? 'online' : 'offline'}
        </p>
      </header>

      {error && <p className="banner error">{error}</p>}

      <section className="panel-block">
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
                  {hasSched && <span className="mark sched" title="Scheduled" />}
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
      </section>

      <section className="panel-block">
        <h2>Week plan</h2>
        <p className="muted">
          New rides come from ChatGPT/MCP week planning, or{' '}
          <strong>Schedule again</strong> on a past Activity below / on History.
          No workout catalog here.
        </p>
        <div className="form-row">
          <button
            type="button"
            disabled={healthy === false || scheduled.length === 0}
            onClick={() => void onClearMonth()}
          >
            Clear month schedule
          </button>
        </div>
        <p className="muted">
          Clear removes Scheduled Rides in this month (MCP{' '}
          <code>clear_scheduled_rides</code>). Orphan Workouts with no Activities
          are dropped. Activities stay.
        </p>
      </section>

      <section className="panel-block">
        <h2>{selectedKey}</h2>

        <h3 className="cal-section-title">Scheduled</h3>
        {selectedScheduled.length === 0 ? (
          <p className="muted">Nothing scheduled.</p>
        ) : (
          <ul className="entity-list">
            {selectedScheduled.map((ride) => (
              <li key={ride.id} className="cal-item">
                <div>
                  <strong>{workoutName(ride.workoutId)}</strong>
                  <span className="muted">
                    {new Date(ride.startsAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="cal-item-actions">
                  <button
                    type="button"
                    className="primary"
                    onClick={() => onStartScheduledWorkout(ride.workoutId)}
                  >
                    Start on Ride
                  </button>
                  <button type="button" onClick={() => void onDelete(ride.id)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h3 className="cal-section-title">Activities</h3>
        {selectedActivities.length === 0 ? (
          <p className="muted">No completed rides this day.</p>
        ) : (
          <ul className="entity-list">
            {selectedActivities.map((activity) => (
              <li key={activity.id} className="workout-row">
                <div className="workout-row-meta activity-row-meta">
                  <div>
                    <strong>
                      {new Date(activity.startedAt).toLocaleTimeString()}
                    </strong>
                    <span className="muted">
                      {Math.round(activity.durationSec / 60)} min
                      {activity.averagePowerWatts !== null
                        ? ` · avg ${activity.averagePowerWatts} W`
                        : ''}
                    </span>
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
                  <PowerProfileLine
                    label={`Activity ${activity.id}`}
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
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
