import { describe, expect, it, vi } from 'vitest'
import { connectAllKnown } from './connectAllKnown'
import type { ConnectionState } from '../ftms/types'

function role(
  label: string,
  connectionState: ConnectionState,
  knownCount: number,
  options: {
    connect?: ReturnType<typeof vi.fn>
    endsConnected?: boolean
    rememberedName?: string
  } = {},
) {
  const connect = options.connect ?? vi.fn(async () => {})
  const endsConnected = options.endsConnected ?? true
  return {
    label,
    connectionState,
    knownDeviceCount: knownCount,
    rememberedName: options.rememberedName ?? null,
    connect,
    getConnectionState: () =>
      endsConnected ? ('connected' as const) : connectionState,
  }
}

describe('connectAllKnown', () => {
  it('connects roles with known devices and skips connected / empty', async () => {
    const trainer = role('trainer', 'disconnected', 1)
    const meter = role('power meter', 'connected', 1)
    const hr = role('heart rate', 'disconnected', 0)
    const cadence = role('cadence', 'disconnected', 1)

    const summary = await connectAllKnown([trainer, meter, hr, cadence])

    expect(trainer.connect).toHaveBeenCalledOnce()
    expect(meter.connect).not.toHaveBeenCalled()
    expect(hr.connect).not.toHaveBeenCalled()
    expect(cadence.connect).toHaveBeenCalledOnce()
    expect(summary).toBe(
      'Connected 2 of 4 — heart rate needs Find new…',
    )
  })

  it('reports all connected when every role with known devices succeeds', async () => {
    const roles = [
      role('trainer', 'disconnected', 1),
      role('power meter', 'disconnected', 1),
    ]
    const summary = await connectAllKnown(roles)
    expect(summary).toBe('Connected 2 of 2.')
  })

  it('reports when nothing to connect', async () => {
    const summary = await connectAllKnown([
      role('trainer', 'connected', 1),
      role('heart rate', 'disconnected', 0),
    ])
    expect(summary).toBe(
      'No known devices to connect — heart rate needs Find new…',
    )
  })

  it('does not count a failed connect as success', async () => {
    const trainer = role('trainer', 'disconnected', 1, {
      endsConnected: false,
    })
    const summary = await connectAllKnown([trainer])
    expect(summary).toBe('Connected 0 of 1.')
  })

  it('names the remembered device to Re-pair instead of sending the rider to Find new', async () => {
    const summary = await connectAllKnown([
      role('trainer', 'disconnected', 0, { rememberedName: 'D100 0421' }),
      role('power meter', 'disconnected', 0),
      role('heart rate', 'disconnected', 0, { rememberedName: 'Polar H10 7A1B' }),
    ])
    expect(summary).toBe(
      'No known devices to connect — Re-pair trainer (D100 0421) / heart rate (Polar H10 7A1B); power meter needs Find new…',
    )
  })

  it('mixes connected roles with a Re-pair list', async () => {
    const summary = await connectAllKnown([
      role('trainer', 'disconnected', 1, { rememberedName: 'D100 0421' }),
      role('heart rate', 'disconnected', 0, { rememberedName: 'Polar H10 7A1B' }),
    ])
    expect(summary).toBe(
      'Connected 1 of 2 — Re-pair heart rate (Polar H10 7A1B)',
    )
  })
})
