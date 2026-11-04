import { describe, expect, it } from 'vitest'
import {
  PERSISTENCE_HINT_DISMISSED_KEY,
  loadPersistenceHintDismissed,
  savePersistenceHintDismissed,
  shouldShowPersistenceHint,
} from './persistenceHint'

const base = {
  webBluetoothSupported: true,
  getDevicesAvailable: true,
  knownDevicesChecked: true,
  dismissed: false,
}

describe('shouldShowPersistenceHint', () => {
  it('stays hidden on first run, when nothing is remembered yet', () => {
    expect(
      shouldShowPersistenceHint({
        ...base,
        getDevicesAvailable: false,
        roles: [{ remembered: false, knownMatchesRemembered: false }],
      }),
    ).toBe(false)
  })

  it('shows when a device is remembered but this Chrome has no getDevices()', () => {
    expect(
      shouldShowPersistenceHint({
        ...base,
        getDevicesAvailable: false,
        roles: [{ remembered: true, knownMatchesRemembered: false }],
      }),
    ).toBe(true)
  })

  it('shows when getDevices() came back without any remembered device', () => {
    expect(
      shouldShowPersistenceHint({
        ...base,
        roles: [
          { remembered: true, knownMatchesRemembered: false },
          { remembered: true, knownMatchesRemembered: false },
          { remembered: false, knownMatchesRemembered: false },
        ],
      }),
    ).toBe(true)
  })

  it('stays hidden when at least one remembered device survived, since permissions do persist', () => {
    expect(
      shouldShowPersistenceHint({
        ...base,
        roles: [
          { remembered: true, knownMatchesRemembered: true },
          { remembered: true, knownMatchesRemembered: false },
        ],
      }),
    ).toBe(false)
  })

  it('waits until Known Devices have been read, so it does not flash on load', () => {
    expect(
      shouldShowPersistenceHint({
        ...base,
        knownDevicesChecked: false,
        roles: [{ remembered: true, knownMatchesRemembered: false }],
      }),
    ).toBe(false)
  })

  it('stays hidden once dismissed', () => {
    expect(
      shouldShowPersistenceHint({
        ...base,
        dismissed: true,
        roles: [{ remembered: true, knownMatchesRemembered: false }],
      }),
    ).toBe(false)
  })

  it('stays hidden without Web Bluetooth (the unavailable banner covers it)', () => {
    expect(
      shouldShowPersistenceHint({
        ...base,
        webBluetoothSupported: false,
        roles: [{ remembered: true, knownMatchesRemembered: false }],
      }),
    ).toBe(false)
  })
})

describe('persistence hint dismissal', () => {
  it('is remembered in storage', () => {
    const map = new Map<string, string>()
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    }
    expect(loadPersistenceHintDismissed(storage)).toBe(false)
    savePersistenceHintDismissed(storage)
    expect(map.has(PERSISTENCE_HINT_DISMISSED_KEY)).toBe(true)
    expect(loadPersistenceHintDismissed(storage)).toBe(true)
  })

  it('treats blocked storage as not dismissed and does not throw', () => {
    const storage = {
      getItem: (): string | null => {
        throw new Error('SecurityError')
      },
      setItem: (): void => {
        throw new Error('SecurityError')
      },
    }
    expect(loadPersistenceHintDismissed(storage)).toBe(false)
    expect(() => savePersistenceHintDismissed(storage)).not.toThrow()
    expect(loadPersistenceHintDismissed(null)).toBe(false)
  })
})
