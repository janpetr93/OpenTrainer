import {
  uploadActivityToStrava as postUpload,
  type Activity,
} from '../api'
import { activityFitFilename, encodeActivityFit } from './encodeActivityFit'

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

/** Encode Activity FIT in the browser and upload via Local Companion Strava Link. */
export async function uploadActivityFitToStrava(
  activity: Activity,
  options: { force?: boolean } = {},
): Promise<Activity> {
  const bytes = encodeActivityFit(activity)
  const result = await postUpload({
    activityId: activity.id,
    fitBase64: bytesToBase64(bytes),
    name: activityFitFilename(activity).replace(/\.fit$/i, ''),
    force: options.force,
  })
  return result.activity
}
