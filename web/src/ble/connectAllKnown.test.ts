import { describe, expect, it, vi } from 'vitest'
import {
  bulkConnectLabel,
  connectAllKnown,
  repairBlockedByGesture,
} from './connectAllKnown'
import type { ConnectionState } from '../ftms/types'

function role(
  label: string,
  connectionState: ConnectionState,
  knownCount: number,
  options: {
    connect?: ReturnType<typeof vi.fn>
    repair?: ReturnType<typeof vi.fn>
    repairBlocked?: () => boolean
    needsGesture?: boolean
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
    repair: options.repair,
    repairBlocked: options.repairBlocked,
    needsGesture: options.needsGesture,
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

  it('re-pairs every remembered device from the same click, before known-device connects', async () => {
    const order: string[] = []
    const trainer = role('trainer', 'disconnected', 0, {
      rememberedName: 'VANRYSEL-HT-fc75',
      repair: vi.fn(async () => {
        order.push('trainer')
      }),
    })
    const meter = role('power meter', 'disconnected', 0, {
      rememberedName: 'ASSIOMA43274U',
      repair: vi.fn(async () => {
        order.push('meter')
      }),
    })
    const hr = role('heart rate', 'disconnected', 1, {
      connect: vi.fn(async () => {
        order.push('hr')
      }),
    })

    const summary = await connectAllKnown([trainer, meter, hr])

    expect(order).toEqual(['trainer', 'meter', 'hr'])
    expect(trainer.connect).not.toHaveBeenCalled()
    expect(summary).toBe('Connected 3 of 3.')
  })

  it('keeps going when one re-pair fails for a reason other than the click expiring', async () => {
    const trainer = role('trainer', 'disconnected', 0, {
      rememberedName: 'VANRYSEL-HT-fc75',
      repair: vi.fn(async () => {}),
      endsConnected: false,
      repairBlocked: () => false,
    })
    const hr = role('heart rate', 'disconnected', 0, {
      rememberedName: 'HRM Belt 32306',
      repair: vi.fn(async () => {}),
    })

    const summary = await connectAllKnown([trainer, hr])

    expect(hr.repair).toHaveBeenCalledOnce()
    expect(summary).toBe(
      'Connected 1 of 2 — Re-pair trainer (VANRYSEL-HT-fc75)',
    )
  })

  it('asks for a fresh gesture before each later re-pair that opens a chooser', async () => {
    const order: string[] = []
    const renewGesture = vi.fn(async (start: () => Promise<void>) => {
      order.push('gesture')
      await start()
    })
    const trainer = role('trainer', 'disconnected', 0, {
      rememberedName: 'VANRYSEL-HT-fc75',
      needsGesture: true,
      repair: vi.fn(async () => {
        order.push('trainer')
      }),
    })
    const meter = role('power meter', 'disconnected', 0, {
      rememberedName: 'ASSIOMA43274U',
      needsGesture: true,
      repair: vi.fn(async () => {
        order.push('meter')
      }),
    })
    const cadence = role('cadence', 'disconnected', 0, {
      rememberedName: '7678-1',
      repair: vi.fn(async () => {
        order.push('cadence')
      }),
    })

    await connectAllKnown([trainer, meter, cadence], { renewGesture })

    expect(order).toEqual(['trainer', 'gesture', 'meter', 'cadence'])
    expect(renewGesture).toHaveBeenCalledOnce()
  })

  it('stops the rest of the run when the browser rejects another chooser', async () => {
    const trainer = role('trainer', 'disconnected', 0, {
      rememberedName: 'VANRYSEL-HT-fc75',
      repair: vi.fn(async () => {}),
      endsConnected: false,
      repairBlocked: () => true,
    })
    const meter = role('power meter', 'disconnected', 0, {
      rememberedName: 'ASSIOMA43274U',
      repair: vi.fn(async () => {}),
    })
    const cadence = role('cadence', 'disconnected', 0, {
      rememberedName: '7678-1',
      repair: vi.fn(async () => {}),
    })

    const summary = await connectAllKnown([trainer, meter, cadence])

    expect(trainer.repair).toHaveBeenCalledOnce()
    expect(meter.repair).not.toHaveBeenCalled()
    expect(cadence.repair).not.toHaveBeenCalled()
    expect(summary).toBe(
      'Connected 0 of 3 — click Re-pair all again for trainer (VANRYSEL-HT-fc75), power meter (ASSIOMA43274U) / cadence (7678-1)',
    )
  })
})

describe('bulkConnectLabel', () => {
  it('says Re-pair all when every pending role is only remembered', () => {
    expect(
      bulkConnectLabel([
        role('trainer', 'disconnected', 0, { rememberedName: 'VANRYSEL-HT-fc75' }),
        role('power meter', 'connected', 0, { rememberedName: 'ASSIOMA43274U' }),
        role('cadence', 'disconnected', 0),
      ]),
    ).toBe('Re-pair all')
  })

  it('says Connect all known when a Known Device can reconnect without a chooser', () => {
    expect(
      bulkConnectLabel([
        role('trainer', 'disconnected', 1, { rememberedName: 'VANRYSEL-HT-fc75' }),
        role('heart rate', 'disconnected', 0, { rememberedName: 'HRM Belt 32306' }),
      ]),
    ).toBe('Connect all known')
  })
})

describe('repairBlockedByGesture', () => {
  it('matches Chrome refusing another chooser from the same click', () => {
    expect(
      repairBlockedByGesture(
        "Failed to execute 'requestDevice' on 'Bluetooth': Must be handling a user gesture to show a permission request.",
      ),
    ).toBe(true)
    expect(repairBlockedByGesture('Chooser closed.')).toBe(false)
    expect(repairBlockedByGesture(null)).toBe(false)
  })
})
