export const ADVERTISEMENT_WAIT_MS = 8000

export type PreconnectableDevice = {
  name?: string
  gatt?: { connect(): Promise<unknown> }
  watchAdvertisements?: (options?: { signal?: AbortSignal }) => Promise<void>
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}

/**
 * Open GATT on a device returned by getDevices(). Tries a direct connect first
 * (a trainer still linked from before may not advertise at all). If that
 * fails, which is typical right after a browser restart because the adapter has
 * not seen the device yet, wait for one advertisement and connect again.
 */
export async function preconnectKnownDevice(
  device: PreconnectableDevice,
  options: { timeoutMs?: number; label?: string } = {},
): Promise<void> {
  const connect = device.gatt?.connect.bind(device.gatt)
  if (!connect) throw new Error('This device has no GATT server.')
  try {
    await connect()
    return
  } catch (firstError) {
    if (typeof device.watchAdvertisements !== 'function') throw firstError
    const outcome = await waitForAdvertisement(
      device,
      options.timeoutMs ?? ADVERTISEMENT_WAIT_MS,
    )
    if (outcome === 'unsupported') throw firstError
    if (outcome === 'timeout') {
      const who = device.name?.trim() || options.label || 'The device'
      throw new Error(
        `${who} is not advertising — wake it, then Connect again.`,
      )
    }
    await connect()
  }
}

async function waitForAdvertisement(
  device: PreconnectableDevice,
  timeoutMs: number,
): Promise<'advertised' | 'timeout' | 'unsupported'> {
  const abort = new AbortController()
  let onAdvertisement: () => void = () => {}
  let timer: ReturnType<typeof setTimeout> | undefined
  const seen = new Promise<'advertised'>((resolve) => {
    onAdvertisement = () => resolve('advertised')
    device.addEventListener('advertisementreceived', onAdvertisement)
  })
  const timedOut = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs)
  })
  try {
    await device.watchAdvertisements!({ signal: abort.signal })
  } catch {
    clearTimeout(timer)
    device.removeEventListener('advertisementreceived', onAdvertisement)
    return 'unsupported'
  }
  try {
    return await Promise.race([seen, timedOut])
  } finally {
    clearTimeout(timer)
    device.removeEventListener('advertisementreceived', onAdvertisement)
    abort.abort()
  }
}
