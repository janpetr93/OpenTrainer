export type KnownDeviceRef = {
  id: string
  name: string
}

/**
 * Prefer explicit id, then last-used in session, else first Known Device.
 */
export function pickKnownDevice<T extends KnownDeviceRef>(
  known: T[],
  options: {
    deviceId?: string
    lastUsedDeviceId?: string | null
  } = {},
): T | null {
  if (known.length === 0) return null
  if (options.deviceId) {
    const match = known.find((d) => d.id === options.deviceId)
    if (match) return match
  }
  if (options.lastUsedDeviceId) {
    const match = known.find((d) => d.id === options.lastUsedDeviceId)
    if (match) return match
  }
  return known[0] ?? null
}
