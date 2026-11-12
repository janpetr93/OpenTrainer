import {
  rideKeyAction,
  type RideKeyCommand,
  type RideKeyMode,
} from './domain/rideIntensity'

export type RideKeyHandlers = {
  /** The ride holding the keys, or null when no ride runs or is paused. */
  rideMode: () => RideKeyMode | null
  onCommand: (command: RideKeyCommand) => void
}

/** Text fields keep their keys, Space included. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) {
    return false
  }
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/**
 * Ride keys work on every tab while a ride runs or is paused.
 *
 * Space pauses and resumes, and never reaches a focused button while riding:
 * the browser would otherwise also press the last control the rider clicked
 * (Stop included), or press it again on a held key. Blocking Space on both
 * keydown and keyup stops that activation in every browser.
 */
export function installRideKeys(
  target: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  handlers: RideKeyHandlers,
): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || isEditableTarget(event.target)) return
    const mode = handlers.rideMode()
    if (mode === null) return
    if (event.key === ' ') event.preventDefault()
    const command = rideKeyAction(event, mode)
    if (!command) return
    event.preventDefault()
    handlers.onCommand(command)
  }
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.key !== ' ' || isEditableTarget(event.target)) return
    if (handlers.rideMode() !== null) event.preventDefault()
  }
  target.addEventListener('keydown', onKeyDown)
  target.addEventListener('keyup', onKeyUp)
  return () => {
    target.removeEventListener('keydown', onKeyDown)
    target.removeEventListener('keyup', onKeyUp)
  }
}
