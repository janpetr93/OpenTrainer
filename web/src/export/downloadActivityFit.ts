import type { Activity } from '../api'
import { activityFitFilename, encodeActivityFit } from './encodeActivityFit'

/** Trigger a browser download of the Activity as an indoor FIT file. */
export function downloadActivityFit(activity: Activity): void {
  const bytes = encodeActivityFit(activity)
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const blob = new Blob([copy], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = activityFitFilename(activity)
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
