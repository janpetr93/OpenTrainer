export type KnownDevice = {
  id: string
  name: string
}

export function toKnownDevice(device: BluetoothDevice, fallbackName: string): KnownDevice {
  return {
    id: device.id,
    name: device.name?.trim() || fallbackName,
  }
}
