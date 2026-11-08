import { describe, expect, it, vi } from 'vitest'
import { armRepair, performInGesture, rememberedRepair } from './desktopBluetooth'

describe('armRepair', () => {
  it('does nothing when the page is not the desktop app', () => {
    expect(() => armRepair('VANRYSEL-HT-fc75')).not.toThrow()
  })
})

describe('performInGesture', () => {
  it('runs immediately when there is no desktop shell', async () => {
    const start = vi.fn(async () => {})
    await performInGesture(start, null)
    expect(start).toHaveBeenCalledOnce()
  })
})

describe('rememberedRepair', () => {
  it('calls open before awaiting, so requestDevice stays in the gesture turn', async () => {
    const order: string[] = []
    const open = vi.fn(() => {
      order.push('open')
      return Promise.resolve().then(() => {
        order.push('settled')
      })
    })
    const run = rememberedRepair('ASSIOMA43274U', open)
    const pending = run()
    order.push('returned')
    await pending
    expect(order).toEqual(['open', 'returned', 'settled'])
  })
})
