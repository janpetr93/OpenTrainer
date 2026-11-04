import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { preconnectKnownDevice } from './preconnectKnownDevice'

type FakeOptions = {
  /** Outcome of each gatt.connect() call, in order. */
  connects: Array<'ok' | 'fail'>
  /** 'never' = watch succeeds but no advertisement arrives. */
  advertiseAfterMs?: number | 'never'
  watch?: 'supported' | 'missing' | 'rejects'
}

function fakeDevice(options: FakeOptions) {
  const target = new EventTarget()
  const outcomes = [...options.connects]
  let watchSignal: AbortSignal | undefined
  const connect = vi.fn(async () => {
    const next = outcomes.shift() ?? 'fail'
    if (next === 'fail') {
      throw new Error('NetworkError: Bluetooth Device is no longer in range.')
    }
    return {}
  })
  const watchAdvertisements = vi.fn(
    async (watchOptions?: { signal?: AbortSignal }) => {
      watchSignal = watchOptions?.signal
      if (options.watch === 'rejects') {
        throw new Error('NotSupportedError')
      }
      if (options.advertiseAfterMs !== 'never') {
        setTimeout(() => {
          target.dispatchEvent(new Event('advertisementreceived'))
        }, options.advertiseAfterMs ?? 0)
      }
    },
  )
  const device = {
    name: 'D100 0421',
    gatt: { connect },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    ...(options.watch === 'missing' ? {} : { watchAdvertisements }),
  }
  return {
    device,
    connect,
    watchAdvertisements,
    watchSignal: () => watchSignal,
  }
}

describe('preconnectKnownDevice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('connects straight away when the device is reachable, without scanning', async () => {
    const fake = fakeDevice({ connects: ['ok'] })
    await preconnectKnownDevice(fake.device, { timeoutMs: 8000 })
    expect(fake.connect).toHaveBeenCalledOnce()
    expect(fake.watchAdvertisements).not.toHaveBeenCalled()
  })

  it('after a restart, waits for an advertisement and retries the connect', async () => {
    const fake = fakeDevice({
      connects: ['fail', 'ok'],
      advertiseAfterMs: 1200,
    })
    const done = preconnectKnownDevice(fake.device, { timeoutMs: 8000 })
    await vi.advanceTimersByTimeAsync(1200)
    await done
    expect(fake.watchAdvertisements).toHaveBeenCalledOnce()
    expect(fake.connect).toHaveBeenCalledTimes(2)
    expect(fake.watchSignal()?.aborted).toBe(true)
  })

  it('gives up with a wake-it message when nothing advertises in time', async () => {
    const fake = fakeDevice({ connects: ['fail'], advertiseAfterMs: 'never' })
    const done = preconnectKnownDevice(fake.device, { timeoutMs: 8000 })
    const assertion = expect(done).rejects.toThrow(
      'D100 0421 is not advertising — wake it, then Connect again.',
    )
    await vi.advanceTimersByTimeAsync(8000)
    await assertion
    expect(fake.connect).toHaveBeenCalledOnce()
    expect(fake.watchSignal()?.aborted).toBe(true)
  })

  it('rethrows the original error when this Chrome has no watchAdvertisements()', async () => {
    const fake = fakeDevice({ connects: ['fail'], watch: 'missing' })
    await expect(
      preconnectKnownDevice(fake.device, { timeoutMs: 8000 }),
    ).rejects.toThrow('no longer in range')
    expect(fake.connect).toHaveBeenCalledOnce()
  })

  it('rethrows the original error when watchAdvertisements() is refused', async () => {
    const fake = fakeDevice({ connects: ['fail'], watch: 'rejects' })
    await expect(
      preconnectKnownDevice(fake.device, { timeoutMs: 8000 }),
    ).rejects.toThrow('no longer in range')
  })
})
