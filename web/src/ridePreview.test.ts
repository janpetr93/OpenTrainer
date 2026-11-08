import { describe, expect, it } from 'vitest'
import { readRidePreview } from './ridePreview'

describe('readRidePreview', () => {
  it('returns a frozen in-progress Workout when the dev URL asks for it', () => {
    const frame = readRidePreview('?preview=ride', true)
    expect(frame).not.toBeNull()
    expect(frame!.runner.status).toBe('running')
    expect(frame!.runner.workoutName).toBe('VO2 30/15')
    expect(frame!.runner.stepIndex).toBe(3)
    expect(frame!.runner.stepCount).toBe(8)
    expect(frame!.runner.stepRemainingSec).toBe(18)
    expect(frame!.runner.stepTargetWatts).toBe(280)
    expect(frame!.snapshot.connectionState).toBe('connected')
    expect(frame!.snapshot.watts).toBe(248)
    expect(frame!.snapshot.powerStatus).toBe('fresh')
    expect(frame!.heartRate.bpm).toBeNull()
    expect(frame!.plannedProfile.length).toBeGreaterThanOrEqual(2)
    expect(frame!.achievedProfile.at(-1)?.tSec).toBe(frame!.runner.elapsedSec)
    expect(frame!.achievedProfile.at(-1)?.watts).toBe(248)
    expect(frame!.achievedProfile.some((point) => point.hrBpm != null)).toBe(
      false,
    )
    expect(
      frame!.achievedProfile.filter((point) => point.cadenceRpm != null).length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('stays off without the query and in a production build', () => {
    expect(readRidePreview('', true)).toBeNull()
    expect(readRidePreview('?foo=1', true)).toBeNull()
    expect(readRidePreview('?preview=ride', false)).toBeNull()
  })
})