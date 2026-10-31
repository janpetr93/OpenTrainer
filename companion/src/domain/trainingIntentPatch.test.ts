import { describe, expect, it } from 'vitest'
import { mergeTrainingIntent } from './trainingIntentPatch.js'

const current = {
  goal: 'Raise FTP',
  horizon: 'May fondo',
  note: 'week 1 of 4x8',
  maxHardDaysPerWeek: 2,
  preferredLongRideWeekday: 6,
  constraintsNote: 'No early mornings',
}

describe('mergeTrainingIntent', () => {
  it('keeps constraints when only the note is updated', () => {
    expect(mergeTrainingIntent(current, { note: 'week 2 of 4x8' })).toEqual({
      ...current,
      note: 'week 2 of 4x8',
    })
  })

  it('clears a field when the patch sends null', () => {
    expect(mergeTrainingIntent(current, { note: null }).note).toBeNull()
    expect(mergeTrainingIntent(current, { note: null }).maxHardDaysPerWeek).toBe(2)
  })

  it('requires a goal when Intent is unset', () => {
    expect(() => mergeTrainingIntent(null, { note: 'week 1' })).toThrow(/goal/i)
  })
})
