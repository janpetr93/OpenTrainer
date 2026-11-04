export type KnownDeviceRef = {
  id: string
  name: string
}

export type RememberedRef = {
  id: string
  name: string | null
}

/**
 * The Known Device that is the remembered one: same id, else same exact name
 * (ids are origin-scoped, so a new port or origin gets a new id).
 */
export function findRememberedDevice<
  T extends { id: string; name?: string | null },
>(known: T[], remembered: RememberedRef | null): T | null {
  if (!remembered) return null
  const byId = known.find((d) => d.id === remembered.id)
  if (byId) return byId
  if (!remembered.name) return null
  return known.find((d) => d.name?.trim() === remembered.name) ?? null
}

/**
 * Prefer explicit id, then last-used in session, then the remembered device,
 * else first Known Device.
 */
export function pickKnownDevice<T extends KnownDeviceRef>(
  known: T[],
  options: {
    deviceId?: string
    lastUsedDeviceId?: string | null
    remembered?: RememberedRef | null
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
  const remembered = findRememberedDevice(known, options.remembered ?? null)
  if (remembered) return remembered
  return known[0] ?? null
}
