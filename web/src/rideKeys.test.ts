// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import type { RideKeyCommand, RideKeyMode } from './domain/rideIntensity'
import { installRideKeys } from './rideKeys'

function setup(mode: RideKeyMode | null) {
  const commands: RideKeyCommand[] = []
  const state = { mode }
  const uninstall = installRideKeys(window, {
    rideMode: () => state.mode,
    onCommand: (command) => commands.push(command),
  })
  return { commands, state, uninstall }
}

function press(
  target: EventTarget,
  type: 'keydown' | 'keyup',
  key: string,
  init: KeyboardEventInit = {},
): KeyboardEvent {
  const event = new KeyboardEvent(type, { key, bubbles: true, cancelable: true, ...init })
  target.dispatchEvent(event)
  return event
}

let cleanup: (() => void) | null = null
afterEach(() => {
  cleanup?.()
  cleanup = null
  document.body.innerHTML = ''
})

describe('installRideKeys', () => {
  it('toggles pause with Space while a ride runs', () => {
    const { commands, uninstall } = setup('workout')
    cleanup = uninstall
    const down = press(document.body, 'keydown', ' ')
    expect(down.defaultPrevented).toBe(true)
    expect(commands).toEqual([{ kind: 'togglePause' }])
  })

  it('keeps Space away from the last clicked button, also on a held key', () => {
    const { commands, uninstall } = setup('freeRide')
    cleanup = uninstall
    const stop = document.createElement('button')
    document.body.append(stop)
    stop.focus()

    expect(press(stop, 'keydown', ' ').defaultPrevented).toBe(true)
    expect(press(stop, 'keydown', ' ', { repeat: true }).defaultPrevented).toBe(true)
    expect(press(stop, 'keyup', ' ').defaultPrevented).toBe(true)
    expect(commands).toEqual([{ kind: 'togglePause' }])
  })

  it('leaves Space alone when no ride is active', () => {
    const { commands, uninstall } = setup(null)
    cleanup = uninstall
    expect(press(document.body, 'keydown', ' ').defaultPrevented).toBe(false)
    expect(press(document.body, 'keyup', ' ').defaultPrevented).toBe(false)
    expect(commands).toEqual([])
  })

  it('leaves Space to text fields', () => {
    const { commands, uninstall } = setup('workout')
    cleanup = uninstall
    const input = document.createElement('input')
    document.body.append(input)
    expect(press(input, 'keydown', ' ').defaultPrevented).toBe(false)
    expect(press(input, 'keyup', ' ').defaultPrevented).toBe(false)
    expect(commands).toEqual([])
  })

  it('still routes intensity keys and stops listening once removed', () => {
    const { commands, uninstall } = setup('workout')
    press(document.body, 'keydown', 'ArrowUp')
    uninstall()
    press(document.body, 'keydown', ' ')
    expect(commands).toEqual([{ kind: 'nudge', delta: 1 }])
  })
})
