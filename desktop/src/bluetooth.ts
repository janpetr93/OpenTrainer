import {
  BrowserWindow,
  dialog,
  ipcMain,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type Session,
  type WebContents,
} from 'electron'
import { clearTimeout, setTimeout } from 'node:timers'
import { BluetoothChooser, repairPick } from './bluetoothChooser.js'

export type PickerAssets = {
  /** picker.html */
  html: string
  /** Sandboxed CommonJS preload for the picker window. */
  preload: string
}

type PairingResponse = { confirmed: boolean; pin?: string | null }

const PICKER_BACKGROUND = '#f4f6f8'

/** How long a Re-pair waits for the remembered name before showing the picker. */
const REPAIR_FALLBACK_MS = 8000

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/**
 * Web Bluetooth in Electron has no built-in device chooser: the page's
 * `navigator.bluetooth.requestDevice()` turns into `select-bluetooth-device`
 * events here. This shows a small picker window over the app window, lists
 * what the scan finds (already filtered by the page's service filters), and
 * answers with the chosen device or with a cancel.
 *
 * Everything stays in the main process, so the renderer's connection code
 * runs unchanged in Chrome, Edge, and the desktop app.
 */
export class BluetoothPicker {
  private readonly chooser = new BluetoothChooser()
  private pickerWindow: BrowserWindow | null = null
  private pageContents: WebContents | null = null
  /** Remembered name the page asked to re-pair. Unset for Find new. */
  private armedRepairName: string | null = null
  private repairFallback: ReturnType<typeof setTimeout> | null = null
  private pinPrompt: {
    window: BrowserWindow
    respond: (response: PairingResponse) => void
  } | null = null

  constructor(
    private readonly assets: PickerAssets,
    private readonly log: (message: string) => void = () => {},
  ) {
    ipcMain.handle('picker:list', (event) =>
      event.sender === this.pickerWindow?.webContents ? this.chooser.devices() : [],
    )
    ipcMain.on('picker:choose', (event, deviceId: unknown) => {
      if (!this.fromPicker(event) || typeof deviceId !== 'string') return
      const name = this.describe(deviceId)
      if (this.chooser.choose(deviceId)) {
        this.log(`Bluetooth: chose ${name}`)
        this.closePicker()
      }
    })
    ipcMain.on('picker:cancel', (event) => {
      if (this.fromPicker(event)) {
        this.cancelRequest()
        return
      }
      if (event.sender === this.pinPrompt?.window.webContents) {
        this.finishPin({ confirmed: false })
      }
    })
    ipcMain.on('picker:pin', (event, pin: unknown) => {
      if (event.sender !== this.pinPrompt?.window.webContents) return
      if (typeof pin !== 'string' || !pin.trim()) return
      this.finishPin({ confirmed: true, pin: pin.trim() })
    })
    ipcMain.on('bluetooth:arm-repair', (event, name: unknown) => {
      if (!this.fromPage(event) || typeof name !== 'string' || !name.trim()) {
        event.returnValue = false
        return
      }
      this.armedRepairName = name.trim()
      event.returnValue = true
    })
    ipcMain.handle('bluetooth:finish-repair', (event) => {
      if (!this.fromPage(event)) return
      this.disarmRepair()
    })
    ipcMain.handle('bluetooth:click', (event, x: unknown, y: unknown) => {
      if (!this.fromPage(event)) return
      this.clickPage(event.sender, numberOr(x, 4), numberOr(y, 4))
    })
  }

  /** Handle `requestDevice()` from this window's page. */
  attach(win: BrowserWindow): void {
    this.pageContents = win.webContents
    win.webContents.on('select-bluetooth-device', (event, devices, callback) => {
      event.preventDefault()
      const started = this.chooser.update(devices, callback)
      if (this.armedRepairName) {
        const id = repairPick(this.chooser.devices(), this.armedRepairName)
        if (id && this.chooser.choose(id)) {
          this.log(`Bluetooth: re-paired ${this.armedRepairName}`)
          this.clearRepairFallback()
          return
        }
        if (started) {
          this.log(`Bluetooth: re-pair waiting for ${this.armedRepairName}`)
          this.scheduleRepairFallback(win)
        }
        return
      }
      if (started) {
        this.log('Bluetooth: device request started')
        this.openPicker(win)
      }
      this.pushDevices()
    })
    win.on('closed', () => {
      this.pageContents = null
      this.disarmRepair()
      this.cancelRequest()
      this.finishPin({ confirmed: false })
    })
  }

  /**
   * Windows and Linux can ask the app to confirm a pairing or enter a PIN.
   * macOS pairs on its own and never calls this handler.
   */
  installPairingHandler(ses: Session, parent: () => BrowserWindow | null): void {
    if (process.platform !== 'win32' && process.platform !== 'linux') return
    ses.setBluetoothPairingHandler((details, callback) => {
      const name = this.chooser.nameOf(details.deviceId) ?? 'this Bluetooth device'
      const owner = parent()
      if (details.pairingKind === 'providePin') {
        this.openPinPrompt(owner, name, callback)
        return
      }
      const detail =
        details.pairingKind === 'confirmPin' && details.pin
          ? `Check that ${name} shows PIN ${details.pin}.`
          : `${name} asks to pair with this computer.`
      const options = {
        type: 'question' as const,
        buttons: ['Pair', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        message: 'Pair Bluetooth device?',
        detail,
      }
      const shown = owner ? dialog.showMessageBox(owner, options) : dialog.showMessageBox(options)
      shown
        .then(({ response }) => callback({ confirmed: response === 0 }))
        .catch(() => callback({ confirmed: false }))
    })
  }

  private fromPicker(event: IpcMainEvent): boolean {
    return event.sender === this.pickerWindow?.webContents
  }

  private fromPage(event: IpcMainEvent | IpcMainInvokeEvent): boolean {
    return this.pageContents !== null && event.sender === this.pageContents
  }

  private disarmRepair(): void {
    this.armedRepairName = null
    this.clearRepairFallback()
  }

  private clearRepairFallback(): void {
    if (!this.repairFallback) return
    clearTimeout(this.repairFallback)
    this.repairFallback = null
  }

  /** The remembered device never advertised: let the rider pick, and stop auto-choosing. */
  private scheduleRepairFallback(win: BrowserWindow): void {
    if (this.repairFallback) return
    this.repairFallback = setTimeout(() => {
      this.repairFallback = null
      if (!this.armedRepairName || !this.chooser.active) return
      this.log(`Bluetooth: re-pair did not see ${this.armedRepairName}`)
      this.armedRepairName = null
      this.openPicker(win)
      this.pushDevices()
    }, REPAIR_FALLBACK_MS)
    this.repairFallback.unref()
  }

  /** A real click in the page, so the next requestDevice is inside a user gesture. */
  private clickPage(contents: WebContents, x: number, y: number): void {
    if (contents.isDestroyed()) return
    contents.focus()
    contents.sendInputEvent({ type: 'mouseMove', x, y })
    contents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 })
    contents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 })
  }

  private describe(deviceId: string): string {
    return this.chooser.nameOf(deviceId) ?? 'unnamed device'
  }

  /**
   * Open the same picker for a scan that did not come from Web Bluetooth
   * (the macOS cadence sensor). Resolves to the chosen id, or '' on cancel.
   */
  prompt(
    parent: BrowserWindow,
    hint: string,
  ): {
    update(devices: { id: string; name: string }[]): void
    result: Promise<string>
    close(): void
  } {
    if (this.chooser.active) {
      throw new Error('A Bluetooth device list is already open.')
    }
    let settled = false
    let resolveResult: (id: string) => void = () => {}
    const result = new Promise<string>((resolve) => {
      resolveResult = resolve
    })
    const settle = (id: string): void => {
      if (settled) return
      settled = true
      resolveResult(id)
    }
    this.chooser.update([], settle)
    this.openPicker(parent, hint)
    return {
      update: (devices) => {
        if (settled) return
        this.chooser.update(
          devices.map((device) => ({ deviceId: device.id, deviceName: device.name })),
          settle,
        )
        this.pushDevices()
      },
      result,
      close: () => {
        if (!settled) this.cancelRequest()
      },
    }
  }

  private openPicker(parent: BrowserWindow, hint?: string): void {
    this.closePicker()
    const picker = this.createDialogWindow(parent, 'Choose a Bluetooth device', 520)
    this.pickerWindow = picker
    picker.on('closed', () => {
      // closePicker() clears pickerWindow first, so this only runs when the
      // rider closed the window without choosing: that is a cancel.
      if (this.pickerWindow !== picker) return
      this.pickerWindow = null
      this.cancelRequest()
    })
    const query: Record<string, string> = { mode: 'devices' }
    if (hint) query.hint = hint
    void picker.loadFile(this.assets.html, { query })
  }

  private pushDevices(): void {
    const contents: WebContents | undefined = this.pickerWindow?.webContents
    if (!contents || contents.isDestroyed() || contents.isLoading()) return
    contents.send('picker:devices', this.chooser.devices())
  }

  private cancelRequest(): void {
    try {
      if (this.chooser.cancel()) this.log('Bluetooth: device request cancelled')
    } catch (error) {
      this.log(`Bluetooth: cancel failed: ${String(error)}`)
    }
    this.closePicker()
  }

  private closePicker(): void {
    const picker = this.pickerWindow
    this.pickerWindow = null
    if (picker && !picker.isDestroyed()) picker.close()
  }

  private openPinPrompt(
    parent: BrowserWindow | null,
    deviceName: string,
    callback: (response: PairingResponse) => void,
  ): void {
    this.finishPin({ confirmed: false })
    const window = this.createDialogWindow(parent, 'Bluetooth PIN', 300)
    this.pinPrompt = { window, respond: callback }
    window.on('closed', () => {
      if (this.pinPrompt?.window === window) this.finishPin({ confirmed: false })
    })
    void window.loadFile(this.assets.html, { query: { mode: 'pin', device: deviceName } })
  }

  private finishPin(response: PairingResponse): void {
    const prompt = this.pinPrompt
    if (!prompt) return
    this.pinPrompt = null
    try {
      prompt.respond(response)
    } catch (error) {
      this.log(`Bluetooth: pairing response failed: ${String(error)}`)
    }
    if (!prompt.window.isDestroyed()) prompt.window.close()
  }

  private createDialogWindow(
    parent: BrowserWindow | null,
    title: string,
    height: number,
  ): BrowserWindow {
    const usable = parent && !parent.isDestroyed() ? parent : undefined
    const window = new BrowserWindow({
      parent: usable,
      modal: usable !== undefined,
      width: 460,
      height,
      minWidth: 380,
      minHeight: Math.min(height, 360),
      show: false,
      title,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      autoHideMenuBar: true,
      backgroundColor: PICKER_BACKGROUND,
      webPreferences: {
        preload: this.assets.preload,
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        spellcheck: false,
      },
    })
    window.removeMenu()
    window.once('ready-to-show', () => window.show())
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', (event) => event.preventDefault())
    return window
  }
}
