import type { PickerDevice } from '../bluetoothChooser.js'

type PickerApi = {
  list(): Promise<PickerDevice[]>
  onDevices(listener: (devices: PickerDevice[]) => void): void
  choose(deviceId: string): void
  cancel(): void
  submitPin(pin: string): void
}

const api = (window as unknown as { openTrainerPicker: PickerApi }).openTrainerPicker
const params = new URLSearchParams(window.location.search)

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing #${id}`)
  return element as T
}

function showDevices(): void {
  const view = byId<HTMLElement>('devices-view')
  const list = byId<HTMLUListElement>('device-list')
  const scanningText = byId<HTMLElement>('scanning-text')
  view.hidden = false

  const render = (devices: PickerDevice[]): void => {
    scanningText.textContent =
      devices.length === 0
        ? 'Looking for devices…'
        : `Still scanning · ${devices.length} found`
    const focusedId = (document.activeElement as HTMLElement | null)?.dataset.deviceId
    list.replaceChildren(
      ...devices.map((device) => {
        const item = document.createElement('li')
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'device'
        button.dataset.deviceId = device.id

        const name = document.createElement('span')
        name.className = device.name ? 'device-name' : 'device-name unnamed'
        name.textContent = device.name || 'Unnamed device'

        const action = document.createElement('span')
        action.className = 'device-action'
        action.textContent = 'Connect'

        button.append(name, action)
        button.addEventListener('click', () => api.choose(device.id))
        item.append(button)
        return item
      }),
    )
    if (focusedId) {
      list.querySelector<HTMLButtonElement>(`[data-device-id="${CSS.escape(focusedId)}"]`)?.focus()
    }
  }

  byId<HTMLButtonElement>('cancel').addEventListener('click', () => api.cancel())
  api.onDevices(render)
  void api.list().then(render)
}

function showPin(): void {
  const view = byId<HTMLElement>('pin-view')
  const device = params.get('device')
  if (device) byId<HTMLElement>('pin-hint').textContent = `${device} asks for a PIN to pair.`
  view.hidden = false
  const input = byId<HTMLInputElement>('pin')
  input.focus()
  byId<HTMLFormElement>('pin-form').addEventListener('submit', (event) => {
    event.preventDefault()
    if (input.value.trim()) api.submitPin(input.value.trim())
  })
  byId<HTMLButtonElement>('pin-cancel').addEventListener('click', () => api.cancel())
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') api.cancel()
})

if (params.get('mode') === 'pin') {
  showPin()
} else {
  showDevices()
}
