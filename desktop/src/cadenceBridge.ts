import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { clearTimeout, setTimeout } from 'node:timers'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { ipcMain } from 'electron'
import type { BluetoothPicker } from './bluetooth.js'
import { cadenceCandidates, type ScannedPeripheral } from './cadenceCandidates.js'
import { parseCadenceHelperEvent, type CadenceHelperEvent } from './cadenceProtocol.js'

const REMEMBERED_WAIT_MS = 8000
const CONNECT_WAIT_MS = 20000
const READY_WAIT_MS = 8000

const PICKER_HINT =
  'Spin the crank to wake the cadence sensor. It sleeps after about a minute, and it may show up with no name. Closest devices are listed first.'

export const CADENCE_BRIDGE_UNAVAILABLE = 'CADENCE_BRIDGE_UNAVAILABLE'

type ConnectedDevice = { id: string; name: string | null }
type ConnectTarget = { deviceId?: string; name?: string }

/**
 * Mac cadence link. Web Bluetooth hides sensors that omit the CSC service and
 * a known name from their advertisement; this talks to CoreBluetooth instead.
 */
export function installCadenceBridge(options: {
  helperPath: string
  picker: BluetoothPicker
  parent: () => BrowserWindow | null
  log: (message: string) => void
}): { stop(): void } {
  const session = new CadenceSession(options)

  ipcMain.handle('cadence:connect', (event, raw: unknown) => {
    assertSender(event, options.parent)
    return session.connect(targetFrom(raw))
  })
  ipcMain.handle('cadence:disconnect', (event) => {
    assertSender(event, options.parent)
    return session.disconnect()
  })

  session.onMeasurement = (bytes) => {
    const contents = options.parent()?.webContents
    if (contents && !contents.isDestroyed()) contents.send('cadence:measurement', bytes)
  }
  session.onDisconnected = () => {
    const contents = options.parent()?.webContents
    if (contents && !contents.isDestroyed()) contents.send('cadence:disconnected')
  }

  return {
    stop() {
      session.stop()
    },
  }
}

function assertSender(event: IpcMainInvokeEvent, parent: () => BrowserWindow | null): void {
  if (event.sender !== parent()?.webContents) {
    throw new Error('Denied')
  }
}

function targetFrom(raw: unknown): ConnectTarget {
  if (typeof raw !== 'object' || raw === null) return {}
  const record = raw as { deviceId?: unknown; name?: unknown }
  const target: ConnectTarget = {}
  if (record.deviceId !== undefined) {
    if (typeof record.deviceId !== 'string' || record.deviceId.trim() === '') {
      throw new Error('Bad cadence device id.')
    }
    target.deviceId = record.deviceId
  }
  if (typeof record.name === 'string' && record.name.trim()) target.name = record.name.trim()
  return target
}

class CadenceSession {
  onMeasurement: ((bytes: number[]) => void) | null = null
  onDisconnected: (() => void) | null = null

  private child: ChildProcessWithoutNullStreams | null = null
  private buffer = ''
  private ready: Promise<void> | null = null
  private resolveReady: (() => void) | null = null
  private rejectReady: ((error: Error) => void) | null = null
  private devices = new Map<string, ScannedPeripheral>()
  private scanListeners = new Set<() => void>()
  private rejectOperation: ((error: Error) => void) | null = null
  private cleanup = (): void => {}
  private connectedWait: ((event: { id: string; name: string }) => void) | null = null
  private disconnectWait: (() => void) | null = null
  private live = false
  private lastLogged = ''
  private loggedPacket = false

  constructor(
    private readonly options: {
      helperPath: string
      picker: BluetoothPicker
      parent: () => BrowserWindow | null
      log: (message: string) => void
    },
  ) {}

  async connect(target: ConnectTarget = {}): Promise<ConnectedDevice> {
    try {
      await this.ensure()
      this.devices.clear()
      this.lastLogged = ''
      this.loggedPacket = false
      this.send({ cmd: 'scan' })

      let id: string | undefined
      if (target.deviceId || target.name) {
        id = await this.waitForMatch(REMEMBERED_WAIT_MS, (device) => {
          if (target.deviceId && device.id === target.deviceId) return true
          return Boolean(target.name) && device.name.trim() === target.name
        })
      }
      if (!id) id = await this.chooseFromPicker()

      this.send({ cmd: 'connect', id })
      return await this.waitForConnected()
    } catch (error) {
      if (!this.live) this.send({ cmd: 'stop' })
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (!this.child) return
    this.live = false
    this.send({ cmd: 'disconnect' })
    await new Promise<void>((resolve) => {
      const finish = (): void => {
        if (this.disconnectWait !== finish) return
        this.disconnectWait = null
        resolve()
      }
      this.disconnectWait = finish
      setTimeout(finish, 3000).unref()
    })
  }

  stop(): void {
    this.live = false
    this.send({ cmd: 'shutdown' })
    const child = this.child
    this.child = null
    setTimeout(() => {
      if (child && !child.killed) child.kill()
    }, 400).unref()
  }

  private async ensure(): Promise<void> {
    if (!existsSync(this.options.helperPath)) {
      throw new Error(CADENCE_BRIDGE_UNAVAILABLE)
    }
    if (this.child && this.ready) {
      await this.ready
      return
    }

    this.ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve
      this.rejectReady = reject
    })
    const child = spawn(this.options.helperPath, [], { stdio: ['pipe', 'pipe', 'pipe'] })
    this.child = child
    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => this.onStdout(chunk))
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      const text = chunk.trim()
      if (text) this.options.log(`Cadence scanner: ${text}`)
    })
    child.on('error', (error) => {
      this.settleReady(error instanceof Error ? error : new Error(String(error)))
    })
    child.on('exit', () => {
      if (this.child === child) this.child = null
      this.ready = null
      if (this.live) {
        this.live = false
        this.onDisconnected?.()
      }
      this.settleReady(new Error('Cadence scanner stopped.'))
      this.fail(new Error('Cadence scanner stopped.'))
    })

    const timeout = setTimeout(() => {
      this.settleReady(new Error(CADENCE_BRIDGE_UNAVAILABLE))
    }, READY_WAIT_MS)
    try {
      await this.ready
    } finally {
      clearTimeout(timeout)
    }
  }

  private waitForMatch(
    ms: number,
    match: (device: ScannedPeripheral) => boolean,
  ): Promise<string | undefined> {
    const existing = [...this.devices.values()].find(match)
    if (existing) return Promise.resolve(existing.id)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.scanListeners.delete(listener)
        this.rejectOperation = null
        this.cleanup = () => {}
        resolve(undefined)
      }, ms)
      const listener = (): void => {
        const found = [...this.devices.values()].find(match)
        if (!found) return
        clearTimeout(timer)
        this.scanListeners.delete(listener)
        this.rejectOperation = null
        this.cleanup = () => {}
        resolve(found.id)
      }
      this.rejectOperation = reject
      this.cleanup = () => {
        clearTimeout(timer)
        this.scanListeners.delete(listener)
      }
      this.scanListeners.add(listener)
    })
  }

  private chooseFromPicker(): Promise<string> {
    const parent = this.options.parent()
    if (!parent) {
      return Promise.reject(new Error('OpenTrainer has no window to show the cadence sensor list.'))
    }
    const prompt = this.options.picker.prompt(parent, PICKER_HINT)
    const listed = (): { id: string; name: string }[] =>
      cadenceCandidates([...this.devices.values()])
    this.logCandidates(listed())
    prompt.update(listed())

    return new Promise((resolve, reject) => {
      let settled = false
      const finish = (id: string): void => {
        if (settled) return
        settled = true
        this.scanListeners.delete(listener)
        const rejectOperation = this.rejectOperation
        this.rejectOperation = null
        this.cleanup = () => {}
        if (!id) {
          this.send({ cmd: 'stop' })
          rejectOperation?.(new Error('chooser closed'))
          return
        }
        resolve(id)
      }
      const listener = (): void => {
        const devices = listed()
        this.logCandidates(devices)
        prompt.update(devices)
      }
      this.rejectOperation = reject
      this.cleanup = () => {
        this.scanListeners.delete(listener)
        prompt.close()
      }
      this.scanListeners.add(listener)
      void prompt.result.then(finish)
    })
  }

  private waitForConnected(): Promise<ConnectedDevice> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.fail(new Error('The cadence sensor did not respond. Spin the crank and try again.'))
      }, CONNECT_WAIT_MS)
      this.rejectOperation = reject
      this.cleanup = () => clearTimeout(timer)
      this.connectedWait = (event) => {
        clearTimeout(timer)
        this.cleanup = () => {}
        this.rejectOperation = null
        this.connectedWait = null
        this.live = true
        const name = event.name.trim()
        resolve({ id: event.id, name: name ? name : null })
      }
    })
  }

  private logCandidates(devices: { id: string; name: string }[]): void {
    const summary = devices.map((device) => device.name || '(unnamed)').join(', ') || '(none)'
    if (summary === this.lastLogged) return
    this.lastLogged = summary
    this.options.log(`Cadence scan: ${summary}`)
  }

  private fail(error: Error): void {
    this.connectedWait = null
    const reject = this.rejectOperation
    this.rejectOperation = null
    this.cleanup()
    this.cleanup = () => {}
    reject?.(error)
    this.disconnectWait?.()
    this.disconnectWait = null
  }

  private settleReady(error?: Error): void {
    const reject = this.rejectReady
    const resolve = this.resolveReady
    if (!reject && !resolve) return
    this.resolveReady = null
    this.rejectReady = null
    if (error) {
      this.ready = null
      const child = this.child
      this.child = null
      if (child && !child.killed) child.kill()
      reject?.(error)
      return
    }
    resolve?.()
  }

  private onStdout(chunk: string): void {
    this.buffer += chunk
    for (;;) {
      const newline = this.buffer.indexOf('\n')
      if (newline < 0) return
      const line = this.buffer.slice(0, newline).trim()
      this.buffer = this.buffer.slice(newline + 1)
      if (line) this.onLine(line)
    }
  }

  private onLine(line: string): void {
    const event = parseCadenceHelperEvent(line)
    if (!event) {
      this.options.log('Cadence scanner sent an unreadable line')
      return
    }
    if (event.event === 'ready') {
      this.settleReady()
      return
    }
    if (event.event === 'device') {
      this.devices.set(event.id, event)
      this.logCandidates(cadenceCandidates([...this.devices.values()]))
      for (const listener of this.scanListeners) listener()
      return
    }
    if (event.event === 'measurement') {
      if (!this.loggedPacket) {
        this.loggedPacket = true
        const hex = event.bytes.map((byte) => byte.toString(16).padStart(2, '0')).join(' ')
        this.options.log(`Cadence data: ${hex}`)
      }
      if (this.live) this.onMeasurement?.(event.bytes)
      return
    }
    if (event.event === 'connected') {
      this.connectedWait?.(event)
      return
    }
    if (event.event === 'disconnected') {
      this.disconnectWait?.()
      this.disconnectWait = null
      if (this.live) {
        this.live = false
        this.onDisconnected?.()
      }
      return
    }
    if (event.event === 'error') {
      const error = new Error(event.message)
      if (this.rejectReady) this.settleReady(error)
      if (this.live && !this.rejectOperation) {
        this.live = false
        this.onDisconnected?.()
        return
      }
      this.fail(error)
    }
  }

  private send(command: unknown): void {
    try {
      this.child?.stdin.write(`${JSON.stringify(command)}\n`)
    } catch (error) {
      this.options.log(`Cadence scanner write failed: ${String(error)}`)
    }
  }
}
