/**
 * Keep the screen (and so the computer) awake while a ride runs or is paused.
 * A sleeping display or Mac drops the trainer and sensor Bluetooth links.
 *
 * The desktop app holds an Electron power save blocker in the main process,
 * which also works while the window is hidden. Chrome and Edge use the Screen
 * Wake Lock API, which the browser releases whenever the tab is hidden, so the
 * lock is requested again each time the page becomes visible.
 */

/** Desktop shell hook (`window.openTrainer.power`). Chrome never has it. */
export type DesktopPower = {
  keepAwake(active: boolean): Promise<void> | void
}

export type WakeLockSentinelLike = {
  readonly released: boolean
  release(): Promise<void>
}

export type WakeLockLike = {
  request(type: 'screen'): Promise<WakeLockSentinelLike>
}

export type VisibilityLike = {
  readonly visibilityState: DocumentVisibilityState
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

export type KeepAwakeDeps = {
  desktop: DesktopPower | null
  wakeLock: WakeLockLike | null
  visibility: VisibilityLike | null
}

export class KeepAwake {
  private active = false
  private sentinel: WakeLockSentinelLike | null = null
  private requesting = false
  private readonly deps: KeepAwakeDeps

  constructor(deps: KeepAwakeDeps) {
    this.deps = deps
  }

  setActive(active: boolean): void {
    if (active === this.active) return
    this.active = active
    const { desktop, visibility } = this.deps
    if (desktop) {
      void Promise.resolve()
        .then(() => desktop.keepAwake(active))
        .catch(() => {
          // An older desktop shell has no power channel. Nothing to undo.
        })
      return
    }
    if (active) {
      visibility?.addEventListener('visibilitychange', this.onVisibilityChange)
      void this.acquire()
    } else {
      visibility?.removeEventListener('visibilitychange', this.onVisibilityChange)
      void this.release()
    }
  }

  private readonly onVisibilityChange = (): void => {
    if (!this.active || this.deps.visibility?.visibilityState !== 'visible') return
    if (this.sentinel && !this.sentinel.released) return
    void this.acquire()
  }

  private async acquire(): Promise<void> {
    const { wakeLock, visibility } = this.deps
    if (!wakeLock || this.requesting) return
    // A hidden page cannot take the lock; visibilitychange retries.
    if (visibility && visibility.visibilityState !== 'visible') return
    this.requesting = true
    try {
      const sentinel = await wakeLock.request('screen')
      if (this.active) {
        this.sentinel = sentinel
      } else {
        await sentinel.release()
      }
    } catch {
      // Denied, or the page hid during the request: visibilitychange retries.
    } finally {
      this.requesting = false
    }
  }

  private async release(): Promise<void> {
    const sentinel = this.sentinel
    this.sentinel = null
    if (!sentinel || sentinel.released) return
    try {
      await sentinel.release()
    } catch {
      // Already released by the browser.
    }
  }
}

type KeepAwakeWindow = Window & {
  openTrainer?: { power?: DesktopPower }
}

export function createKeepAwake(): KeepAwake {
  if (typeof window === 'undefined') {
    return new KeepAwake({ desktop: null, wakeLock: null, visibility: null })
  }
  const desktop = (window as KeepAwakeWindow).openTrainer?.power ?? null
  const wakeLock =
    (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock ?? null
  return new KeepAwake({ desktop, wakeLock, visibility: document })
}
