import { describe, expect, it } from 'vitest'
import { resolvePowerSourceMode } from './powerSourceMode'

describe('resolvePowerSourceMode', () => {
  it('is meter-primary when the Power Meter is fresh at Start', () => {
    expect(resolvePowerSourceMode({ meterFresh: true })).toBe('meter')
  })

  it('is trainer-primary when the Power Meter is not fresh', () => {
    expect(resolvePowerSourceMode({ meterFresh: false })).toBe('trainer')
  })
})
