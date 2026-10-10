import { describe, expect, it } from 'vitest'
import { pickKnownDevice } from './pickKnownDevice'

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
})
