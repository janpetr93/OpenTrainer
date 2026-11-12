import { describe, expect, it } from 'vitest'
import type { Blocker } from '../api'
import {
  blockerSessionTitle,
  completedBlockerMeta,
} from './sessionModuleHelpers'

function run(partial: Partial<Blocker> = {}): Blocker {
  return {
    id: 'b1',
    kind: 'run',
    startsAt: '2026-10-17T09:01:39.000Z',
    allDay: false,
    durationMin: 50,
    label: 'Prague Running · rTSS',
    status: 'completed',
    trainingStressScore: 82.8,
    createdAt: '2026-11-12T19:54:43.000Z',
    ...partial,
  }
}

describe('completed Blocker SessionModule helpers', () => {
  it('strips External Load provenance from the title', () => {
    expect(blockerSessionTitle(run())).toBe('Prague Running')
    expect(
      blockerSessionTitle(run({ label: null })),
    ).toBe('Run')
  })

  it('exposes duration and TSS like an Activity row', () => {
    const meta = completedBlockerMeta(run())
    expect(meta.kind).toContain('Completed run')
    expect(meta.kind).toContain('rTSS')
    expect(meta.metrics).toEqual([
      { label: 'Duration', value: '50m' },
      { label: 'TSS', value: '82.8' },
    ])
    expect(meta.when).toMatch(/17/)
  })
})
