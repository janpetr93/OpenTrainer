/** Human label for an MMP duration in seconds. */
export function formatMmpDuration(durationSec: number): string {
  if (durationSec < 60) return `${durationSec}s`
  const minutes = durationSec / 60
  if (Number.isInteger(minutes)) return `${minutes}min`
  return `${durationSec}s`
}
