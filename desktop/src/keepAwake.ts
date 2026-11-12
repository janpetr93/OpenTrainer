import type { PowerSaveBlocker } from 'electron'

type Blocker = Pick<PowerSaveBlocker, 'start' | 'stop' | 'isStarted'>

/**
 * Keeps the display and the Mac or PC awake while a ride runs or is paused.
 * A sleeping computer drops the trainer and sensor Bluetooth links mid-ride.
 *
 * The page turns it on and off over IPC. Unlike the browser's Screen Wake
 * Lock, the power save blocker also holds while the window is hidden behind
 * another app. It is released when the page navigates, reloads, crashes, or
 * the window closes, since none of those leave a ride running.
 */
export class RideKeepAwake {
  private id: number | null = null
  private readonly blocker: Blocker
  private readonly log: (message: string) => void

  constructor(blocker: Blocker, log: (message: string) => void = () => {}) {
    this.blocker = blocker
    this.log = log
  }

  get active(): boolean {
    return this.id !== null && this.blocker.isStarted(this.id)
  }

  set(active: boolean): void {
    if (active) {
      if (this.active) return
      this.id = this.blocker.start('prevent-display-sleep')
      this.log('Keeping the display awake during the ride')
      return
    }
    if (this.id === null) return
    if (this.blocker.isStarted(this.id)) this.blocker.stop(this.id)
    this.id = null
    this.log('Display may sleep again')
  }
}
