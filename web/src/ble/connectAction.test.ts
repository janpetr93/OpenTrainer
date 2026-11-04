import { describe, expect, it } from 'vitest'
import {
  connectActionFor,
  rememberedDeviceRequest,
  repairChooserError,
} from './connectAction'

const remembered = (name: string | null) => ({
  id: 'r1',
  name,
  rememberedAt: '2026-11-04T07:00:00.000Z',
})

describe('connectActionFor', () => {
  it('reconnects a Known Device when the browser still permits one', () => {
    expect(
      connectActionFor({
        knownDevices: [{ id: 'k1', name: 'D100 0421' }],
        remembered: remembered('D100 0421'),
      }),
    ).toEqual({ kind: 'known', label: 'Connect' })
  })

  it('offers a one-click Re-pair of the remembered device when no Known Device is left', () => {
    expect(
      connectActionFor({
        knownDevices: [],
        remembered: remembered('Polar H10 7A1B'),
      }),
    ).toEqual({ kind: 'repair', label: 'Re-pair Polar H10 7A1B' })
  })

  it('opens the normal Device Picker when nothing is remembered', () => {
    expect(connectActionFor({ knownDevices: [], remembered: null })).toEqual({
      kind: 'pick',
      label: 'Connect',
    })
  })

  it('opens the normal Device Picker when the remembered device has no name to filter on', () => {
    expect(
      connectActionFor({ knownDevices: [], remembered: remembered(null) }),
    ).toEqual({ kind: 'pick', label: 'Connect' })
  })
})

describe('rememberedDeviceRequest', () => {
  it('filters the Device Picker to the exact remembered name with the role service optional', () => {
    expect(rememberedDeviceRequest(remembered('D100 0421'), 0x1826)).toEqual({
      filters: [{ name: 'D100 0421' }],
      optionalServices: [0x1826],
    })
  })

  it('returns null when there is no name to filter on', () => {
    expect(rememberedDeviceRequest(remembered(null), 0x180d)).toBeNull()
    expect(rememberedDeviceRequest(null, 0x180d)).toBeNull()
  })
})

describe('repairChooserError', () => {
  it('tells the rider to wake the remembered device when the filtered chooser is closed', () => {
    expect(
      repairChooserError(
        'User cancelled the requestDevice() chooser.',
        remembered('D100 0421'),
        'trainer',
      ),
    ).toBe(
      'Chooser closed. If D100 0421 was not listed, wake it and Re-pair again; for a different trainer use Find new… → Chooser.',
    )
  })

  it('leaves other errors to the default handling', () => {
    expect(
      repairChooserError(
        'GATT Server is disconnected.',
        remembered('D100 0421'),
        'trainer',
      ),
    ).toBeNull()
    expect(
      repairChooserError(
        'User cancelled the requestDevice() chooser.',
        null,
        'trainer',
      ),
    ).toBeNull()
  })
})
