import { describe, expect, it } from 'vitest'
import {
  REMEMBERED_DEVICES_STORAGE_KEY,
  RememberedDeviceStore,
  forgetDevice,
  parseRememberedDevices,
  rememberDevice,
  serializeRememberedDevices,
} from './rememberedDevices'

class MemoryStorage {
  readonly map = new Map<string, string>()
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
}

class ThrowingStorage {
  getItem(): string | null {
    throw new Error('SecurityError')
  }
  setItem(): void {
    throw new Error('QuotaExceededError')
  }
  removeItem(): void {
    throw new Error('SecurityError')
  }
}

const NOW = new Date('2026-11-04T07:00:00.000Z')

describe('parseRememberedDevices', () => {
  it('returns nothing for missing, malformed, or other-version data', () => {
    expect(parseRememberedDevices(null)).toEqual({})
    expect(parseRememberedDevices('not json')).toEqual({})
    expect(parseRememberedDevices('[]')).toEqual({})
    expect(
      parseRememberedDevices(
        JSON.stringify({ version: 2, devices: { trainer: { id: 'x' } } }),
      ),
    ).toEqual({})
  })

  it('keeps valid roles and drops unknown roles and malformed entries', () => {
    const raw = JSON.stringify({
      version: 1,
      devices: {
        trainer: {
          id: 't1',
          name: 'D100 0421',
          rememberedAt: NOW.toISOString(),
        },
        heartRate: { id: 'h1', name: null, rememberedAt: NOW.toISOString() },
        cadence: { id: '', name: 'Bad' },
        powerMeter: 'nope',
        kettle: { id: 'k1', name: 'Kettle', rememberedAt: NOW.toISOString() },
      },
    })
    expect(parseRememberedDevices(raw)).toEqual({
      trainer: { id: 't1', name: 'D100 0421', rememberedAt: NOW.toISOString() },
      heartRate: { id: 'h1', name: null, rememberedAt: NOW.toISOString() },
    })
  })
})

describe('rememberDevice', () => {
  it('replaces the device for that role and leaves the other roles alone', () => {
    const before = rememberDevice(
      {},
      'heartRate',
      { id: 'h1', name: 'Polar H10' },
      NOW,
    )
    const after = rememberDevice(
      before,
      'trainer',
      { id: 't2', name: '  D100 0421  ' },
      NOW,
    )
    expect(after).toEqual({
      heartRate: {
        id: 'h1',
        name: 'Polar H10',
        rememberedAt: NOW.toISOString(),
      },
      trainer: { id: 't2', name: 'D100 0421', rememberedAt: NOW.toISOString() },
    })
    expect(before.trainer).toBeUndefined()
  })

  it('stores a null name when the device has no usable name', () => {
    expect(
      rememberDevice({}, 'cadence', { id: 'c1', name: '   ' }, NOW).cadence,
    ).toEqual({ id: 'c1', name: null, rememberedAt: NOW.toISOString() })
    expect(
      rememberDevice({}, 'cadence', { id: 'c1', name: undefined }, NOW).cadence
        ?.name,
    ).toBeNull()
  })

  it('round-trips through serialize / parse', () => {
    const devices = rememberDevice(
      {},
      'powerMeter',
      { id: 'p1', name: 'ASSIOMA' },
      NOW,
    )
    expect(parseRememberedDevices(serializeRememberedDevices(devices))).toEqual(
      devices,
    )
  })
})

describe('forgetDevice', () => {
  it('removes only that role', () => {
    const devices = rememberDevice(
      rememberDevice({}, 'trainer', { id: 't1', name: 'D100' }, NOW),
      'heartRate',
      { id: 'h1', name: 'Polar H10' },
      NOW,
    )
    expect(forgetDevice(devices, 'trainer')).toEqual({
      heartRate: devices.heartRate,
    })
  })
})

describe('RememberedDeviceStore', () => {
  it('persists under the documented key so a new page load sees it', () => {
    const storage = new MemoryStorage()
    new RememberedDeviceStore(storage, () => NOW).remember('trainer', {
      id: 't1',
      name: 'D100 0421',
    })

    expect(storage.map.has(REMEMBERED_DEVICES_STORAGE_KEY)).toBe(true)
    const reloaded = new RememberedDeviceStore(storage, () => NOW)
    expect(reloaded.get('trainer')).toEqual({
      id: 't1',
      name: 'D100 0421',
      rememberedAt: NOW.toISOString(),
    })
    expect(reloaded.get('heartRate')).toBeNull()
  })

  it('forget clears the role from storage', () => {
    const storage = new MemoryStorage()
    const store = new RememberedDeviceStore(storage, () => NOW)
    store.remember('trainer', { id: 't1', name: 'D100' })
    store.forget('trainer')
    expect(
      new RememberedDeviceStore(storage, () => NOW).get('trainer'),
    ).toBeNull()
  })

  it('keeps working in memory when storage is blocked', () => {
    const store = new RememberedDeviceStore(new ThrowingStorage(), () => NOW)
    expect(store.get('trainer')).toBeNull()
    store.remember('trainer', { id: 't1', name: 'D100' })
    expect(store.get('trainer')?.name).toBe('D100')
  })

  it('works with no storage at all', () => {
    const store = new RememberedDeviceStore(null, () => NOW)
    store.remember('cadence', { id: 'c1', name: 'Magene S3+' })
    expect(store.getAll()).toEqual({
      cadence: {
        id: 'c1',
        name: 'Magene S3+',
        rememberedAt: NOW.toISOString(),
      },
    })
  })
})
