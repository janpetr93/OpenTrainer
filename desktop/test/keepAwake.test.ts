import { describe, expect, it } from 'vitest'
import { RideKeepAwake } from '../src/keepAwake.js'

class FakeBlocker {
  private next = 1
  readonly started = new Set<number>()
  readonly types: string[] = []

  start(type: 'prevent-app-suspension' | 'prevent-display-sleep'): number {
    const id = this.next++
    this.started.add(id)
    this.types.push(type)
    return id
  }

  stop(id: number): boolean {
    return this.started.delete(id)
  }

  isStarted(id: number): boolean {
    return this.started.has(id)
  }
}

describe('RideKeepAwake', () => {
  it('holds one display-sleep blocker while the ride is active', () => {
    const blocker = new FakeBlocker()
    const keepAwake = new RideKeepAwake(blocker)
    keepAwake.set(true)
    keepAwake.set(true)
    expect(blocker.types).toEqual(['prevent-display-sleep'])
    expect(blocker.started.size).toBe(1)
    expect(keepAwake.active).toBe(true)

    keepAwake.set(false)
    keepAwake.set(false)
    expect(blocker.started.size).toBe(0)
    expect(keepAwake.active).toBe(false)
  })

  it('starts again after the ride ends and a new one begins', () => {
    const blocker = new FakeBlocker()
    const keepAwake = new RideKeepAwake(blocker)
    keepAwake.set(true)
    keepAwake.set(false)
    keepAwake.set(true)
    expect(blocker.types).toHaveLength(2)
    expect(blocker.started.size).toBe(1)
  })

  it('replaces a blocker that was stopped elsewhere', () => {
    const blocker = new FakeBlocker()
    const keepAwake = new RideKeepAwake(blocker)
    keepAwake.set(true)
    blocker.started.clear()
    keepAwake.set(true)
    expect(blocker.started.size).toBe(1)
  })

  it('logs each change', () => {
    const lines: string[] = []
    const keepAwake = new RideKeepAwake(new FakeBlocker(), (line) => lines.push(line))
    keepAwake.set(true)
    keepAwake.set(false)
    expect(lines).toHaveLength(2)
  })
})
