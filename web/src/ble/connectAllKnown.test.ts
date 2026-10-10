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
  } = {},
) {
  const connect = options.connect ?? vi.fn(async () => {})
  const endsConnected = options.endsConnected ?? true
  return {
    label,
    connectionState,
    knownDeviceCount: knownCount,
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
})
