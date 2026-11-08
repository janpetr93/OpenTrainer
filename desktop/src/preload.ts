import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

/**
 * Desktop-only hooks. Chrome never sees `openTrainer`.
 * Cadence is macOS-only. Re-pair is every desktop platform: armRepair is
 * synchronous so requestDevice still runs inside the click.
 */
const openTrainer: {
  bluetooth: {
    armRepair: (name: string) => void
    finishRepair: () => Promise<void>
    click: (x: number, y: number) => Promise<void>
  }
  cadence?: {
    connect: (options?: { deviceId?: string; name?: string }) => Promise<{
      id: string
      name: string | null
    }>
    disconnect: () => Promise<void>
    onMeasurement: (listener: (bytes: number[]) => void) => () => void
    onDisconnected: (listener: () => void) => () => void
  }
} = {
  bluetooth: {
    armRepair: (name) => {
      ipcRenderer.sendSync('bluetooth:arm-repair', name)
    },
    finishRepair: () => ipcRenderer.invoke('bluetooth:finish-repair'),
    click: (x, y) => ipcRenderer.invoke('bluetooth:click', x, y),
  },
}

if (process.platform === 'darwin') {
  openTrainer.cadence = {
      connect: (options?: {
        deviceId?: string
        name?: string
      }): Promise<{ id: string; name: string | null }> =>
        ipcRenderer.invoke('cadence:connect', options ?? {}),
      disconnect: (): Promise<void> => ipcRenderer.invoke('cadence:disconnect'),
      onMeasurement: (listener: (bytes: number[]) => void): (() => void) => {
        const wrapped = (_event: IpcRendererEvent, bytes: unknown): void => {
          const values = byteList(bytes)
          if (values) listener(values)
        }
        ipcRenderer.on('cadence:measurement', wrapped)
        return () => ipcRenderer.removeListener('cadence:measurement', wrapped)
      },
      onDisconnected: (listener: () => void): (() => void) => {
        const wrapped = (): void => listener()
        ipcRenderer.on('cadence:disconnected', wrapped)
        return () => ipcRenderer.removeListener('cadence:disconnected', wrapped)
      },
  }
}

contextBridge.exposeInMainWorld('openTrainer', openTrainer)

/** IPC may hand over a plain list or a typed array. A typed array is not an Array. */
function byteList(bytes: unknown): number[] | null {
  const source =
    bytes instanceof Uint8Array ? bytes : Array.isArray(bytes) ? bytes : null
  if (!source) return null
  const values: number[] = []
  for (const item of source) {
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 0 || item > 255) {
      return null
    }
    values.push(item)
  }
  return values
}
