import { contextBridge, ipcRenderer } from 'electron'
import type { PickerDevice } from '../bluetoothChooser.js'

/** The only API the picker page gets; it never sees Node or Electron directly. */
contextBridge.exposeInMainWorld('openTrainerPicker', {
  list: (): Promise<PickerDevice[]> => ipcRenderer.invoke('picker:list'),
  onDevices: (listener: (devices: PickerDevice[]) => void): void => {
    ipcRenderer.on('picker:devices', (_event, devices: PickerDevice[]) => listener(devices))
  },
  choose: (deviceId: string): void => ipcRenderer.send('picker:choose', deviceId),
  cancel: (): void => ipcRenderer.send('picker:cancel'),
  submitPin: (pin: string): void => ipcRenderer.send('picker:pin', pin),
})
