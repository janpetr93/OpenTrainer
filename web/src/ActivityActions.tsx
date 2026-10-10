import { useState } from 'react'
import type { Activity } from './api'
import { downloadActivityFit } from './export/downloadActivityFit'
import { uploadActivityFitToStrava } from './export/uploadActivityToStrava'
import { ScheduleAgain } from './ScheduleAgain'

type Props = {
  activity: Activity
  onActivityUpdate?: (activity: Activity) => void
  onScheduled?: () => void
}

export function ActivityActions({
  activity,
  onActivityUpdate,
  onScheduled,
}: Props) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function onUpload(): Promise<void> {
    const already = Boolean(activity.stravaUpload)
    if (
      already &&
      !window.confirm(
        'This Activity was already uploaded to Strava. Upload again?',
      )
    ) {
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const updated = await uploadActivityFitToStrava(activity, {
        force: already,
      })
      onActivityUpdate?.(updated)
      setMessage('Uploaded to Strava.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="activity-actions">
      <div className="activity-action-buttons">
        <button
          type="button"
          className="export-fit"
          onClick={() => downloadActivityFit(activity)}
        >
          Export FIT
        </button>
        <button
          type="button"
          className="export-fit"
          disabled={busy}
          onClick={() => void onUpload()}
        >
          {busy ? 'Uploading…' : 'Upload to Strava'}
        </button>
        <ScheduleAgain activity={activity} onScheduled={onScheduled} />
      </div>
      {activity.stravaUpload && (
        <p className="muted activity-upload-meta">
          Strava upload #{activity.stravaUpload.uploadId}
          {activity.stravaUpload.stravaActivityId
            ? ` · activity ${activity.stravaUpload.stravaActivityId}`
            : ''}
        </p>
      )}
      {message && <p className="muted activity-upload-meta">{message}</p>}
    </div>
  )
}
