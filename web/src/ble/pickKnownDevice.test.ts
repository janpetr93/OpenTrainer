import { describe, expect, it } from 'vitest'
import { findRememberedDevice, pickKnownDevice } from './pickKnownDevice'

type Dev = { id: string; name: string }

describe('pickKnownDevice', () => {
  const devices: Dev[] = [
    { id: 'a', name: 'Assioma' },
    { id: 'b', name: 'Assioma 2' },
  ]

  it('prefers explicit deviceId when present', () => {
    expect(pickKnownDevice(devices, { deviceId: 'b' })?.id).toBe('b')
  })

  it('prefers lastUsedDeviceId when no explicit id', () => {
    expect(
      pickKnownDevice(devices, { lastUsedDeviceId: 'b' })?.id,
    ).toBe('b')
  })

  it('falls back to first known device', () => {
    expect(pickKnownDevice(devices, {})?.id).toBe('a')
  })

  it('returns null when list empty', () => {
    expect(pickKnownDevice([], { deviceId: 'a' })).toBeNull()
  })

  it('ignores unknown deviceId and uses last-used then first', () => {
    expect(
      pickKnownDevice(devices, {
        deviceId: 'missing',
        lastUsedDeviceId: 'b',
      })?.id,
    ).toBe('b')
  })

  it('prefers the remembered device over the first known device after a restart', () => {
    expect(
      pickKnownDevice(devices, { remembered: { id: 'b', name: 'Assioma 2' } })
        ?.id,
    ).toBe('b')
  })

  it('lets the device used earlier this session win over the remembered one', () => {
    expect(
      pickKnownDevice(devices, {
        lastUsedDeviceId: 'a',
        remembered: { id: 'b', name: 'Assioma 2' },
      })?.id,
    ).toBe('a')
  })
})

describe('findRememberedDevice', () => {
  const devices: Dev[] = [
    { id: 'a', name: 'Polar H10 1111' },
    { id: 'b', name: 'Polar H10 7A1B' },
  ]

  it('matches by id first', () => {
    expect(
      findRememberedDevice(devices, { id: 'b', name: 'Polar H10 1111' })?.id,
    ).toBe('b')
  })

  it('falls back to the exact name when the id changed (new origin or port)', () => {
    expect(
      findRememberedDevice(devices, { id: 'gone', name: 'Polar H10 7A1B' })
        ?.id,
    ).toBe('b')
  })

  it('returns null without a remembered device or a match', () => {
    expect(findRememberedDevice(devices, null)).toBeNull()
    expect(
      findRememberedDevice(devices, { id: 'gone', name: null }),
    ).toBeNull()
    expect(
      findRememberedDevice(devices, { id: 'gone', name: 'Polar H9' }),
    ).toBeNull()
  })
})
