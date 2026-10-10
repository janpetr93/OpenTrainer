import { describe, expect, it } from 'vitest'
import type { WorkoutStep } from '../api'
import { buildScheduledWorkoutPreview } from './scheduledWorkoutPreview'

function step(
  partial: Partial<WorkoutStep> & Pick<WorkoutStep, 'durationSec'>,
): WorkoutStep {
  return {
    type: 'steady',
    targetWatts: 200,
    percentFtp: null,
    zone: null,
    ...partial,
  }
}

describe('buildScheduledWorkoutPreview', () => {
  it('sums step durations and formats the label', () => {
    const preview = buildScheduledWorkoutPreview(
      {
        steps: [step({ durationSec: 60 }), step({ durationSec: 120 })],
      },
      null,
    )
    expect(preview.durationSec).toBe(180)
    expect(preview.durationLabel).toBe('3m')
  })

  it('rebuilds planned Power Profile for absolute-watts steps without FTP', () => {
    const preview = buildScheduledWorkoutPreview(
      {
        steps: [
          step({ durationSec: 60, targetWatts: 100 }),
          step({ durationSec: 120, targetWatts: 200 }),
        ],
      },
      null,
    )
    expect(preview.needsFtpToPreview).toBe(false)
    expect(preview.plannedPowerProfile).toEqual([
      { tSec: 0, watts: 100 },
      { tSec: 60, watts: 100 },
      { tSec: 60, watts: 200 },
      { tSec: 180, watts: 200 },
    ])
  })

  it('gates the chart when %FTP steps need FTP', () => {
    const preview = buildScheduledWorkoutPreview(
      {
        steps: [
          step({
            durationSec: 300,
            targetWatts: null,
            percentFtp: 90,
          }),
        ],
      },
      null,
    )
    expect(preview.durationLabel).toBe('5m')
    expect(preview.needsFtpToPreview).toBe(true)
    expect(preview.plannedPowerProfile).toBeNull()
  })

  it('resolves %FTP planned Power Profile with current FTP', () => {
    const preview = buildScheduledWorkoutPreview(
      {
        steps: [
          step({
            durationSec: 60,
            targetWatts: null,
            percentFtp: 100,
          }),
        ],
      },
      250,
    )
    expect(preview.needsFtpToPreview).toBe(false)
    expect(preview.plannedPowerProfile?.[0]?.watts).toBe(250)
  })
})
