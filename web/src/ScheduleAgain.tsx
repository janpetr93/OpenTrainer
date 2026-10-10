import { useState } from 'react'
import { createScheduledRide, type Activity } from './api'

function localDateTimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

type Props = {
  activity: Activity
  onScheduled?: () => void
}

/** Create a Scheduled Ride from a past Activity that followed a Workout. */
export function ScheduleAgain({ activity, onScheduled }: Props) {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState(() => {
    const d = new Date()
    d.setHours(7, 0, 0, 0)
    return localDateTimeValue(d)
  })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  if (!activity.workoutId) {
    return null
  }

  async function onConfirm(): Promise<void> {
    if (!activity.workoutId || !at) return
    setBusy(true)
    setMessage(null)
    try {
      await createScheduledRide({
        workoutId: activity.workoutId,
        startsAt: new Date(at).toISOString(),
      })
      setMessage('Scheduled.')
      setOpen(false)
      onScheduled?.()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="schedule-again">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)}>
          Schedule again for…
        </button>
      ) : (
        <div className="form-row schedule-again-form">
          <input
            type="datetime-local"
            value={at}
            onChange={(e) => setAt(e.target.value)}
            aria-label="Schedule again date and time"
          />
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {busy ? 'Scheduling…' : 'Confirm'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setOpen(false)
              setMessage(null)
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {message && <p className="muted activity-upload-meta">{message}</p>}
    </div>
  )
}
