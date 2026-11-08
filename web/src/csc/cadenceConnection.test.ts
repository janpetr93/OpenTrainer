import { afterEach, describe, expect, it, vi } from 'vitest'
import { RememberedDeviceStore } from '../ble/rememberedDevices'
import { CadenceConnection } from './cadenceConnection'
import type { NativeCadenceLink } from './nativeCadence'

function memoryStore(): RememberedDeviceStore {
  const saved = new Map<string, string>()
  return new RememberedDeviceStore(
    {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => {
        saved.set(key, value)
      },
    },
    () => new Date('2026-11-08T16:00:00Z'),
  )
}

function fakeLink(): NativeCadenceLink & {
  push(bytes: number[]): void
  drop(): void
} {
  let onMeasurement: ((bytes: number[]) => void) | null = null
  let onDisconnected: (() => void) | null = null
  return {
    connect: async () => ({ id: 'sensor-1', name: 'CADENCE' }),
    disconnect: async () => {},
    onMeasurement(listener) {
      onMeasurement = listener
      return () => {
        onMeasurement = null
      }
    },
    onDisconnected(listener) {
      onDisconnected = listener
      return () => {
        onDisconnected = null
      }
    },
    push(bytes) {
      onMeasurement?.(bytes)
    },
    drop() {
      onDisconnected?.()
    },
  }
}

describe('CadenceConnection native link', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('turns crank notifications into rpm and remembers the sensor', async () => {
    const link = fakeLink()
    const store = memoryStore()
    const connection = new CadenceConnection(store, link)

    await connection.connect()
    link.push([2, 0, 0, 0, 0])
    link.push([2, 1, 0, 0, 4])

    const snapshot = connection.getSnapshot()
    expect(snapshot.connectionState).toBe('connected')
    expect(snapshot.deviceName).toBe('CADENCE')
    expect(snapshot.rpm).toBe(60)
    expect(snapshot.rememberedDevice).toMatchObject({ id: 'sensor-1', name: 'CADENCE' })
    expect(store.get('cadence')).toMatchObject({ id: 'sensor-1', name: 'CADENCE' })

    await connection.disconnect()
  })

  it('asks for the remembered name when re-pairing', async () => {
    const link = fakeLink()
    const calls: Array<{ deviceId?: string; name?: string } | undefined> = []
    link.connect = async (options) => {
      calls.push(options)
      return { id: 'sensor-1', name: '7678-1' }
    }
    const store = memoryStore()
    store.remember('cadence', { id: 'old-web-id', name: '7678-1' })
    const connection = new CadenceConnection(store, link)

    await connection.connect({ autoRepair: true })

    expect(calls).toEqual([{ deviceId: 'old-web-id', name: '7678-1' }])
    await connection.disconnect()
  })

  it('keeps the last rpm when the sensor repeats the same crank count', async () => {
    const link = fakeLink()
    const connection = new CadenceConnection(memoryStore(), link)
    await connection.connect()
    link.push([2, 0, 0, 0, 0])
    link.push([2, 1, 0, 0, 4])
    link.push([2, 1, 0, 0, 4])
    expect(connection.getSnapshot().rpm).toBe(60)
    await connection.disconnect()
  })

  it('drops to zero when the sensor goes quiet after a stop', async () => {
    vi.useFakeTimers()
    const link = fakeLink()
    const connection = new CadenceConnection(memoryStore(), link)
    await connection.connect()
    link.push([2, 0, 0, 0, 0])
    link.push([2, 1, 0, 0, 4])
    expect(connection.getSnapshot().rpm).toBe(60)

    vi.advanceTimersByTime(1000)
    expect(connection.getSnapshot().rpm).toBe(60)
    vi.advanceTimersByTime(1500)
    expect(connection.getSnapshot().rpm).toBe(0)

    await connection.disconnect()
    vi.useRealTimers()
  })

  it('says when the sensor is in speed mode', async () => {
    const link = fakeLink()
    const connection = new CadenceConnection(memoryStore(), link)
    await connection.connect()
    link.push([1, 0, 0, 0, 0, 0, 0])
    expect(connection.getSnapshot().lastError).toMatch(/speed mode/)
    expect(connection.getSnapshot().rpm).toBeNull()
    await connection.disconnect()
  })

  it('keeps the chooser-closed message when the rider cancels', async () => {
    const link = fakeLink()
    link.connect = async () => {
      throw new Error('chooser closed')
    }
    const connection = new CadenceConnection(memoryStore(), link)
    await connection.connect()
    expect(connection.getSnapshot().connectionState).toBe('disconnected')
    expect(connection.getSnapshot().lastError).toMatch(/chooser closed/)
  })
})
