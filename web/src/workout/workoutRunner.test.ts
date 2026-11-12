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

  it('keeps riding as a Free Ride when the plan ends', () => {
    const runner = new WorkoutRunner()
    runner.start(sampleWorkout, 0)
    runner.tick(20_000)
    const snap = runner.getSnapshot()
    expect(snap.status).toBe('running')
    expect(snap.workoutId).toBeNull()
    expect(snap.workoutName).toBe('Free Ride')
    expect(snap.freeRideFromSec).toBe(20)
    // The trainer keeps holding the cool-down until the rider changes it.
    expect(snap.stepTargetWatts).toBe(80)
    expect(snap.targetChanged).toBe(true)

    runner.tick(30_000)
    expect(runner.getSnapshot().elapsedSec).toBe(30)
    runner.stop(31_000)
    expect(runner.getSnapshot().status).toBe('stopped')
    expect(runner.getSnapshot().elapsedSec).toBe(31)
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

  it('plays a Workout Repeat as repeated steps', () => {
    const runner = new WorkoutRunner()
    runner.start(
      {
        id: 'w-rep',
        name: '30/15',
        steps: [
          {
            type: 'repeat',
            count: 2,
            steps: [
              {
                type: 'steady',
                durationSec: 10,
                targetWatts: 200,
                percentFtp: null,
                zone: null,
              },
              {
                type: 'recovery',
                durationSec: 5,
                targetWatts: 100,
                percentFtp: null,
                zone: null,
              },
            ],
          },
        ],
        plannedPowerProfile: [],
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      0,
      null,
    )
    const snap = runner.getSnapshot()
    expect(snap.stepCount).toBe(4)
    expect(snap.totalSec).toBe(30)
    expect(snap.stepTargetWatts).toBe(200)
  })
})

describe('WorkoutRunner Ride Intensity', () => {
  it('starts at 100% with the planned target', () => {
    const runner = new WorkoutRunner()
    runner.start(sampleWorkout, 0)
    const snap = runner.getSnapshot()
    expect(snap.intensityPercent).toBe(100)
    expect(snap.stepPlannedWatts).toBe(100)
    expect(snap.stepTargetWatts).toBe(100)
    expect(runner.getTargetPowerProfile()).toBeNull()
  })

  it('scales the current step at once and flags a new ERG target', () => {
    const runner = new WorkoutRunner()
    runner.start(sampleWorkout, 0)
    runner.tick(6000)
    runner.clearTargetChanged()
    runner.setIntensity(80, 7000)
    const snap = runner.getSnapshot()
    expect(snap.intensityPercent).toBe(80)
    expect(snap.stepPlannedWatts).toBe(200)
    expect(snap.stepTargetWatts).toBe(160)
    expect(snap.targetChanged).toBe(true)
  })

  it('keeps the intensity for later steps', () => {
    const runner = new WorkoutRunner()
    runner.start(sampleWorkout, 0)
    runner.setIntensity(90, 1000)
    runner.tick(16_000)
    const snap = runner.getSnapshot()
    expect(snap.stepIndex).toBe(2)
    expect(snap.stepPlannedWatts).toBe(80)
    expect(snap.stepTargetWatts).toBe(72)
  })

  it('clamps to 50–150% and does not flag an unchanged value', () => {
    const runner = new WorkoutRunner()
    runner.start(sampleWorkout, 0)
    runner.setIntensity(20, 0)
    expect(runner.getSnapshot().intensityPercent).toBe(50)
    runner.clearTargetChanged()
    runner.setIntensity(40, 0)
    expect(runner.getSnapshot().targetChanged).toBe(false)
    runner.setIntensity(400, 0)
    expect(runner.getSnapshot().intensityPercent).toBe(150)
  })

  it('records the targets actually asked for on the plan timeline', () => {
    const runner = new WorkoutRunner()
    runner.start(sampleWorkout, 0)
    runner.tick(7500)
    runner.setIntensity(80, 7500)
    expect(runner.getTargetPowerProfile()).toEqual([
      { tSec: 0, watts: 100 },
      { tSec: 5, watts: 100 },
      { tSec: 5, watts: 200 },
      { tSec: 7, watts: 200 },
      { tSec: 7, watts: 160 },
      { tSec: 15, watts: 160 },
      { tSec: 15, watts: 64 },
      { tSec: 20, watts: 64 },
    ])
  })

  it('reports no target profile after returning to 100% at the same second', () => {
    const runner = new WorkoutRunner()
    runner.start(sampleWorkout, 0)
    runner.setIntensity(80, 0)
    runner.setIntensity(100, 0)
    expect(runner.getTargetPowerProfile()).toBeNull()
  })

  it('shows the scaled target once the Workout is stopped', () => {
    const runner = new WorkoutRunner()
    runner.start(sampleWorkout, 0)
    runner.setIntensity(80, 1000)
    runner.stop(2000)
    expect(runner.getSnapshot().stepTargetWatts).toBe(80)
    expect(runner.getSnapshot().stepPlannedWatts).toBe(100)
  })

  it('resets to 100% on the next start', () => {
    const runner = new WorkoutRunner()
    runner.start(sampleWorkout, 0)
    runner.setIntensity(80, 1000)
    runner.stop(2000)
    runner.start(sampleWorkout, 3000)
    expect(runner.getSnapshot().intensityPercent).toBe(100)
    expect(runner.getTargetPowerProfile()).toBeNull()
  })

  it('ignores intensity while idle or in a Free Ride', () => {
    const runner = new WorkoutRunner()
    runner.setIntensity(80, 0)
    expect(runner.getSnapshot().intensityPercent).toBe(100)
    runner.startFreeRide(0)
    runner.setIntensity(80, 0)
    expect(runner.getSnapshot().intensityPercent).toBe(100)
    expect(runner.getSnapshot().stepTargetWatts).toBeNull()
  })
})

describe('WorkoutRunner Free Ride targets', () => {
  it('has no target until the rider sets one', () => {
    const runner = new WorkoutRunner()
    runner.startFreeRide(0)
    expect(runner.getSnapshot().stepTargetWatts).toBeNull()
    expect(runner.getSnapshot().targetChanged).toBe(false)
    expect(runner.getTargetPowerProfile()).toBeNull()
  })

  it('sets and changes the ERG target', () => {
    const runner = new WorkoutRunner()
    runner.startFreeRide(0)
    runner.tick(30_000)
    runner.setFreeRideTarget(150, 30_000)
    let snap = runner.getSnapshot()
    expect(snap.stepTargetWatts).toBe(150)
    expect(snap.stepPlannedWatts).toBeNull()
    expect(snap.targetChanged).toBe(true)

    runner.clearTargetChanged()
    runner.tick(90_000)
    runner.setFreeRideTarget(175, 90_000)
    runner.tick(120_000)
    snap = runner.getSnapshot()
    expect(snap.stepTargetWatts).toBe(175)
    expect(runner.getTargetPowerProfile()).toEqual([
      { tSec: 30, watts: 150 },
      { tSec: 90, watts: 150 },
      { tSec: 90, watts: 175 },
      { tSec: 120, watts: 175 },
    ])
  })

  it('clamps the target to 30–1500 W', () => {
    const runner = new WorkoutRunner()
    runner.startFreeRide(0)
    runner.setFreeRideTarget(5, 0)
    expect(runner.getSnapshot().stepTargetWatts).toBe(30)
    runner.setFreeRideTarget(5000, 0)
    expect(runner.getSnapshot().stepTargetWatts).toBe(1500)
  })

  it('ignores Free Ride targets during a Workout', () => {
    const runner = new WorkoutRunner()
    runner.start(sampleWorkout, 0)
    runner.setFreeRideTarget(300, 0)
    expect(runner.getSnapshot().stepTargetWatts).toBe(100)
  })

  it('holds no target during an Open Step and ignores Ride Intensity there', () => {
    const runner = new WorkoutRunner()
    runner.start(
      {
        id: 'ftp',
        name: '20 min test',
        steps: [
          {
            type: 'warmup',
            durationSec: 10,
            targetWatts: 100,
            percentFtp: null,
            zone: null,
          },
          {
            type: 'open',
            durationSec: 20,
            targetWatts: null,
            percentFtp: null,
            zone: null,
          },
          {
            type: 'cooldown',
            durationSec: 10,
            targetWatts: 80,
            percentFtp: null,
            zone: null,
          },
        ],
        plannedPowerProfile: [],
        createdAt: '',
      },
      0,
    )
    runner.setIntensity(80, 0)
    expect(runner.getSnapshot().stepTargetWatts).toBe(80)

    runner.tick(10_000)
    const open = runner.getSnapshot()
    expect(open.stepType).toBe('open')
    expect(open.stepTargetWatts).toBeNull()
    runner.setIntensity(90, 10_000)
    expect(runner.getSnapshot().intensityPercent).toBe(80)

    runner.tick(30_000)
    expect(runner.getSnapshot().stepType).toBe('cooldown')
    expect(runner.getSnapshot().stepTargetWatts).toBe(64)
  })

  it('retries simulation when an Open Step resumes', () => {
    const runner = new WorkoutRunner()
    runner.start(
      {
        id: 'ftp',
        name: '20 min test',
        steps: [
          {
            type: 'open',
            durationSec: 20,
            targetWatts: null,
            percentFtp: null,
            zone: null,
          },
        ],
        plannedPowerProfile: [],
        createdAt: '',
      },
      0,
    )
    runner.clearTargetChanged()
    runner.markSimulationRejected()
    runner.pause(1_000)
    expect(runner.getSnapshot().openStepBlocked).toBe(true)
    runner.resume(2_000)
    expect(runner.getSnapshot().targetChanged).toBe(true)
    expect(runner.getSnapshot().status).toBe('running')
  })
})

describe('WorkoutRunner continue as Free Ride', () => {
  it('ends the Workout mid-step and holds that step on the same clock', () => {
    const runner = new WorkoutRunner()
    runner.start(sampleWorkout, 0)
    runner.tick(7_000)
    runner.continueAsFreeRide(7_000)
    const snap = runner.getSnapshot()
    expect(snap.status).toBe('running')
    expect(snap.workoutId).toBeNull()
    expect(snap.freeRideFromSec).toBe(7)
    expect(snap.stepTargetWatts).toBe(200)
    expect(snap.elapsedSec).toBe(7)

    runner.tick(60_000)
    expect(runner.getSnapshot().elapsedSec).toBe(60)
    expect(runner.getSnapshot().status).toBe('running')
  })

  it('records the ridden plan, then the Free Ride targets, from 0 s', () => {
    const runner = new WorkoutRunner()
    runner.start(sampleWorkout, 0)
    runner.tick(7_000)
    runner.continueAsFreeRide(7_000)
    runner.setFreeRideTarget(150, 9_000)
    runner.tick(12_000)
    expect(runner.getTargetPowerProfile()).toEqual([
      { tSec: 0, watts: 100 },
      { tSec: 5, watts: 100 },
      { tSec: 5, watts: 200 },
      { tSec: 7, watts: 200 },
      { tSec: 7, watts: 200 },
      { tSec: 9, watts: 200 },
      { tSec: 9, watts: 150 },
      { tSec: 12, watts: 150 },
    ])
  })

  it('carries Ride Intensity into the held target', () => {
    const runner = new WorkoutRunner()
    runner.start(sampleWorkout, 0)
    runner.setIntensity(80, 0)
    runner.tick(7_000)
    runner.continueAsFreeRide(7_000)
    expect(runner.getSnapshot().stepTargetWatts).toBe(160)
    expect(runner.getSnapshot().intensityPercent).toBe(100)
  })

  it('works while paused and stays paused', () => {
    const runner = new WorkoutRunner()
    runner.start(sampleWorkout, 0)
    runner.pause(3_000)
    runner.continueAsFreeRide(5_000)
    expect(runner.getSnapshot().status).toBe('paused')
    expect(runner.getSnapshot().freeRideFromSec).toBe(3)
    runner.resume(5_000)
    runner.tick(6_000)
    expect(runner.getSnapshot().elapsedSec).toBe(4)
  })

  it('skips the last step into a Free Ride on the same clock', () => {
    const runner = new WorkoutRunner()
    runner.start(sampleWorkout, 0)
    runner.tick(16_000)
    runner.skip(16_000)
    const snap = runner.getSnapshot()
    expect(snap.status).toBe('running')
    expect(snap.workoutId).toBeNull()
    expect(snap.workoutName).toBe('Free Ride')
    expect(snap.freeRideFromSec).toBe(16)
    expect(snap.elapsedSec).toBe(16)
    expect(snap.stepTargetWatts).toBe(80)

    runner.tick(18_000)
    expect(runner.getSnapshot().elapsedSec).toBe(18)
    // The skipped tail of the cool-down is not part of the plan or the recording.
    expect(runner.getTargetPowerProfile()).toEqual([
      { tSec: 0, watts: 100 },
      { tSec: 5, watts: 100 },
      { tSec: 5, watts: 200 },
      { tSec: 15, watts: 200 },
      { tSec: 15, watts: 80 },
      { tSec: 16, watts: 80 },
      { tSec: 16, watts: 80 },
      { tSec: 18, watts: 80 },
    ])
  })

  it('leaves no target when leaving from an Open Step', () => {
    const runner = new WorkoutRunner()
    runner.start(
      {
        id: 'open',
        name: 'Open',
        steps: [
          {
            type: 'warmup',
            durationSec: 10,
            targetWatts: 100,
            percentFtp: null,
            zone: null,
          },
          {
            type: 'open',
            durationSec: 20,
            targetWatts: null,
            percentFtp: null,
            zone: null,
          },
        ],
        plannedPowerProfile: [],
        createdAt: '',
      },
      0,
    )
    runner.tick(15_000)
    runner.continueAsFreeRide(15_000)
    expect(runner.getSnapshot().stepTargetWatts).toBeNull()
    expect(runner.getTargetPowerProfile()).toEqual([
      { tSec: 0, watts: 100 },
      { tSec: 10, watts: 100 },
      { tSec: 10, watts: null },
      { tSec: 15, watts: null },
    ])
  })

  it('does nothing outside a running Workout', () => {
    const runner = new WorkoutRunner()
    runner.continueAsFreeRide(0)
    expect(runner.getSnapshot().status).toBe('idle')

    runner.startFreeRide(0)
    runner.continueAsFreeRide(1_000)
    expect(runner.getSnapshot().freeRideFromSec).toBeNull()

    runner.start(sampleWorkout, 0)
    runner.stop(1_000)
    runner.continueAsFreeRide(2_000)
    expect(runner.getSnapshot().status).toBe('stopped')
    expect(runner.getSnapshot().freeRideFromSec).toBeNull()
  })
})
