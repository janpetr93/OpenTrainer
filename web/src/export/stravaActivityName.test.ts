import { describe, expect, it } from 'vitest'
import { stravaActivityName } from './stravaActivityName'

describe('stravaActivityName', () => {
  it('prefixes the Workout name for structured rides', () => {
    expect(
      stravaActivityName(
        { workoutId: 'w1' },
        [{ id: 'w1', name: 'Sweet spot 2x10' }],
      ),
    ).toBe('OpenTrainer: Sweet spot 2x10')
  })

  it('labels Free Ride when there is no Workout', () => {
    expect(stravaActivityName({ workoutId: null }, [])).toBe(
      'OpenTrainer: Free Ride',
    )
  })

  it('falls back when the Workout is missing', () => {
    expect(stravaActivityName({ workoutId: 'gone' }, [])).toBe(
      'OpenTrainer: Workout',
    )
  })
})
