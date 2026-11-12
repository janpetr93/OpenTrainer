import { describe, expect, it, vi } from 'vitest'
import {
  KeepAwake,
  type VisibilityLike,
  type WakeLockLike,
  type WakeLockSentinelLike,
} from './keepAwake'

class FakeSentinel implements WakeLockSentinelLike {
  released = false
  async release(): Promise<void> {
    this.released = true
  }
}

class FakeWakeLock implements WakeLockLike {
  readonly sentinels: FakeSentinel[] = []
  pending: Array<(sentinel: FakeSentinel) => void> = []
  deferred = false

  request(): Promise<FakeSentinel> {
    const sentinel = new FakeSentinel()
    this.sentinels.push(sentinel)
    if (!this.deferred) return Promise.resolve(sentinel)
    return new Promise((resolve) => this.pending.push(() => resolve(sentinel)))
  }

  get held(): number {
    return this.sentinels.filter((s) => !s.released).length
  }
}

class FakeVisibility implements VisibilityLike {
  visibilityState: DocumentVisibilityState = 'visible'
  private listeners = new Set<() => void>()
  addEventListener(_type: 'visibilitychange', listener: () => void): void {
    this.listeners.add(listener)
  }
  removeEventListener(_type: 'visibilitychange', listener: () => void): void {
    this.listeners.delete(listener)
  }
  set(state: DocumentVisibilityState): void {
    this.visibilityState = state
    for (const listener of this.listeners) listener()
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('KeepAwake in the desktop app', () => {
  it('turns the power save blocker on and off once per change', async () => {
    const keepAwake = vi.fn()
    const awake = new KeepAwake({
      desktop: { keepAwake },
      wakeLock: new FakeWakeLock(),
      visibility: new FakeVisibility(),
    })
    awake.setActive(true)
    awake.setActive(true)
    awake.setActive(false)
    awake.setActive(false)
    await flush()
    expect(keepAwake.mock.calls).toEqual([[true], [false]])
  })

  it('survives an older shell without the power channel', async () => {
    const awake = new KeepAwake({
      desktop: {
        keepAwake: () => {
          throw new Error('No handler registered')
        },
      },
      wakeLock: null,
      visibility: null,
    })
    expect(() => awake.setActive(true)).not.toThrow()
    await flush()
  })
})

describe('KeepAwake in Chrome', () => {
  it('holds a screen wake lock while active and releases it after', async () => {
    const wakeLock = new FakeWakeLock()
    const awake = new KeepAwake({ desktop: null, wakeLock, visibility: new FakeVisibility() })
    awake.setActive(true)
    await flush()
    expect(wakeLock.held).toBe(1)
    awake.setActive(false)
    await flush()
    expect(wakeLock.held).toBe(0)
  })

  it('asks again when the tab comes back, since hiding it drops the lock', async () => {
    const wakeLock = new FakeWakeLock()
    const visibility = new FakeVisibility()
    const awake = new KeepAwake({ desktop: null, wakeLock, visibility })
    awake.setActive(true)
    await flush()

    wakeLock.sentinels[0]!.released = true
    visibility.set('hidden')
    await flush()
    expect(wakeLock.sentinels).toHaveLength(1)

    visibility.set('visible')
    await flush()
    expect(wakeLock.held).toBe(1)
    expect(wakeLock.sentinels).toHaveLength(2)
  })

  it('waits for a hidden tab to show before asking', async () => {
    const wakeLock = new FakeWakeLock()
    const visibility = new FakeVisibility()
    visibility.visibilityState = 'hidden'
    const awake = new KeepAwake({ desktop: null, wakeLock, visibility })
    awake.setActive(true)
    await flush()
    expect(wakeLock.sentinels).toHaveLength(0)
    visibility.set('visible')
    await flush()
    expect(wakeLock.held).toBe(1)
  })

  it('releases a lock that arrives after the ride ended', async () => {
    const wakeLock = new FakeWakeLock()
    wakeLock.deferred = true
    const awake = new KeepAwake({ desktop: null, wakeLock, visibility: new FakeVisibility() })
    awake.setActive(true)
    awake.setActive(false)
    wakeLock.pending.shift()!(new FakeSentinel())
    await flush()
    expect(wakeLock.held).toBe(0)
  })

  it('stops listening for visibility once the ride ends', async () => {
    const wakeLock = new FakeWakeLock()
    const visibility = new FakeVisibility()
    const awake = new KeepAwake({ desktop: null, wakeLock, visibility })
    awake.setActive(true)
    await flush()
    awake.setActive(false)
    await flush()
    visibility.set('hidden')
    visibility.set('visible')
    await flush()
    expect(wakeLock.sentinels).toHaveLength(1)
    expect(wakeLock.held).toBe(0)
  })

  it('does nothing without the Wake Lock API', () => {
    const awake = new KeepAwake({ desktop: null, wakeLock: null, visibility: new FakeVisibility() })
    expect(() => {
      awake.setActive(true)
      awake.setActive(false)
    }).not.toThrow()
  })
})
