import { describe, expect, it } from 'vitest'
import { WorkoutRunner } from './workoutRunner'

const sampleWorkout = {
  id: 'w1',
  name: 'Short',
  steps: [
    {
      type: 'warmup' as const,
      durationSec: 5,
      targetWatts: 100,
      percentFtp: null,
      zone: null,
    },
    {
      type: 'steady' as const,
      durationSec: 10,
      targetWatts: 200,
      percentFtp: null,
      zone: null,
    },
    {
      type: 'cooldown' as const,
      durationSec: 5,
      targetWatts: 80,
      percentFtp: null,
      zone: null,
    },
  ],
  plannedPowerProfile: [],
  createdAt: '2026-01-01T00:00:00.000Z',
}

const percentFtpWorkout = {
  id: 'w2',
  name: '90% FTP',
  steps: [
    {
      type: 'steady' as const,
      durationSec: 60,
      targetWatts: null,
      percentFtp: 90,
      zone: null,
    },
  ],
  plannedPowerProfile: [],
  createdAt: '2026-01-01T00:00:00.000Z',
}

describe('WorkoutRunner', () => {
  it('starts on the first step with full remaining time', () => {
    const runner = new WorkoutRunner()
    runner.start(sampleWorkout, 1000)
    const snap = runner.getSnapshot()
    expect(snap.status).toBe('running')
    expect(snap.stepIndex).toBe(0)
    expect(snap.stepTargetWatts).toBe(100)
    expect(snap.stepRemainingSec).toBe(5)
    expect(snap.elapsedSec).toBe(0)
  })

  it('advances to the next step when duration elapses', () => {
    const runner = new WorkoutRunner()
    runner.start(sampleWorkout, 0)
    runner.tick(5000)
    const snap = runner.getSnapshot()
    expect(snap.stepIndex).toBe(1)
    expect(snap.stepTargetWatts).toBe(200)
    expect(snap.stepRemainingSec).toBe(10)
  })

  it('skip moves to the next step immediately', () => {
    const runner = new WorkoutRunner()
    runner.start(sampleWorkout, 0)
    runner.tick(2000)
    runner.skip(2000)
    expect(runner.getSnapshot().stepIndex).toBe(1)
  })

  it('pause freezes elapsed time until resume', () => {
    const runner = new WorkoutRunner()
    runner.start(sampleWorkout, 0)
    runner.tick(2000)
    runner.pause(2000)
    runner.tick(8000)
    expect(runner.getSnapshot().elapsedSec).toBe(2)
    expect(runner.getSnapshot().status).toBe('paused')
    runner.resume(8000)
    runner.tick(9000)
    expect(runner.getSnapshot().elapsedSec).toBe(3)
    expect(runner.getSnapshot().status).toBe('running')
  })

  it('completes after the last step', () => {
    const runner = new WorkoutRunner()
    runner.start(sampleWorkout, 0)
    runner.tick(20_000)
    expect(runner.getSnapshot().status).toBe('completed')
  })

  it('resolves percentFtp targets from FTP at start', () => {
    const runner = new WorkoutRunner()
    runner.start(percentFtpWorkout, 0, 200)
    expect(runner.getSnapshot().stepTargetWatts).toBe(180)
  })

  it('rejects zone/%FTP workouts without FTP', () => {
    const runner = new WorkoutRunner()
    expect(() => runner.start(percentFtpWorkout, 0, null)).toThrow(/Set FTP/)
  })

  it('startFreeRide tracks elapsed without steps or auto-complete', () => {
    const runner = new WorkoutRunner()
    runner.startFreeRide(0)
    const snap = runner.getSnapshot()
    expect(snap.status).toBe('running')
    expect(snap.workoutId).toBeNull()
    expect(snap.workoutName).toBe('Free Ride')
    expect(snap.stepCount).toBe(0)
    expect(snap.stepTargetWatts).toBeNull()

    runner.tick(12_000)
    expect(runner.getSnapshot().elapsedSec).toBe(12)
    expect(runner.getSnapshot().status).toBe('running')

    runner.stop(15_000)
    expect(runner.getSnapshot().status).toBe('stopped')
    expect(runner.getSnapshot().elapsedSec).toBe(15)
  })
})
