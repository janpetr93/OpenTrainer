/** One entry of Electron's `select-bluetooth-device` device list. */
export type ChooserDevice = {
  deviceId: string
  deviceName: string
}

/** What the picker window shows. */
export type PickerDevice = {
  id: string
  name: string
}

type Pending = {
  callback: (deviceId: string) => void
  devices: Map<string, PickerDevice>
}

/**
 * State for one `navigator.bluetooth.requestDevice()` at a time.
 *
 * Electron fires `select-bluetooth-device` again each time the scan finds
 * more devices, until the callback is called. The chooser keeps the latest
 * callback and the merged device list; `choose` / `cancel` answer it exactly once.
 */
export class BluetoothChooser {
  private pending: Pending | null = null

  get active(): boolean {
    return this.pending !== null
  }

  /** Record a `select-bluetooth-device` event. Returns true when it starts a new request. */
  update(devices: readonly ChooserDevice[], callback: (deviceId: string) => void): boolean {
    const started = this.pending === null
    if (!this.pending) {
      this.pending = { callback, devices: new Map() }
    } else {
      this.pending.callback = callback
    }
    for (const device of devices) {
      const name = device.deviceName.trim()
      const known = this.pending.devices.get(device.deviceId)
      // Keep a name we already saw; some scan results arrive without one.
      this.pending.devices.set(device.deviceId, {
        id: device.deviceId,
        name: name || known?.name || '',
      })
    }
    return started
  }

  devices(): PickerDevice[] {
    if (!this.pending) return []
    return [...this.pending.devices.values()].sort((a, b) => {
      if (!a.name !== !b.name) return a.name ? -1 : 1
      return a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
    })
  }

  nameOf(deviceId: string): string | null {
    return this.pending?.devices.get(deviceId)?.name || null
  }

  /** Answer the request with a listed device. Returns false if nothing is pending or the id is unknown. */
  choose(deviceId: string): boolean {
    const pending = this.pending
    if (!pending || !pending.devices.has(deviceId)) return false
    this.pending = null
    pending.callback(deviceId)
    return true
  }

  /** Answer the request with "no device" (the page's requestDevice rejects). */
  cancel(): boolean {
    const pending = this.pending
    if (!pending) return false
    this.pending = null
    pending.callback('')
    return true
  }
}
