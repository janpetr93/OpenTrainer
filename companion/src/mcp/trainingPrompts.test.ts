import { describe, expect, it } from 'vitest'
import {
  createWorkoutToolDescription,
  planTrainingWeekPrompt,
  reviewTrainingPrompt,
  serverInstructions,
  workoutStepZoneDescription,
} from './trainingPrompts.js'

describe('plan_training_week prompt', () => {
  it('caps hard days and keeps the rest of the week under 75% FTP', () => {
    expect(planTrainingWeekPrompt).toContain('get_training_summary')
    expect(planTrainingWeekPrompt).toContain('check_training_week')
    expect(planTrainingWeekPrompt).toMatch(/type "repeat"/)
    expect(planTrainingWeekPrompt).toContain('under 75% FTP')
    expect(planTrainingWeekPrompt).toContain('maxHardDaysPerWeek')
    expect(planTrainingWeekPrompt).toContain('at most two hard sessions')
    expect(planTrainingWeekPrompt).toMatch(/easy day between/i)
  })

  it('prescribes quality work as percentFtp and refuses zone midpoints for sweet spot and sprints', () => {
    expect(planTrainingWeekPrompt).toContain('percentFtp')
    expect(planTrainingWeekPrompt).toContain('88-94')
    expect(planTrainingWeekPrompt).toMatch(/zone 3 is not sweet spot/i)
    expect(planTrainingWeekPrompt).toMatch(/never use zone 6 or 7/i)
    expect(planTrainingWeekPrompt).toContain('105-108')
    expect(planTrainingWeekPrompt).toMatch(/30 s on \/ 15 s off/i)
  })

  it('progresses from watts held and opens a hard day with short bursts', () => {
    expect(planTrainingWeekPrompt).toContain('averageWatts')
    expect(planTrainingWeekPrompt).toContain('15 s at 120%')
    expect(planTrainingWeekPrompt).not.toMatch(/0\.85/)
    expect(planTrainingWeekPrompt).toMatch(/do not lower percentFtp because targetAdherence is low/i)
    expect(serverInstructions.slice(0, 512)).toContain('15 s at 120%')
    expect(serverInstructions.slice(0, 512)).toContain('averageWatts')
  })

  it('treats Estimated FTP as a hint and does not apply an indoor discount', () => {
    expect(planTrainingWeekPrompt).toMatch(/do not call set_ftp from it/i)
    expect(planTrainingWeekPrompt).toMatch(/do not (lower|discount) FTP/i)
    expect(planTrainingWeekPrompt).toMatch(/fan/i)
  })
})

describe('review_training prompt', () => {
  it('reads zone time and will not write the calendar or FTP unasked', () => {
    expect(reviewTrainingPrompt).toContain('get_training_summary')
    expect(reviewTrainingPrompt).toContain('timeInZonesSec')
    expect(reviewTrainingPrompt).toMatch(/zone 3/i)
    expect(reviewTrainingPrompt).toMatch(/ask before/i)
    expect(reviewTrainingPrompt).toMatch(/do not create workouts/i)
    expect(reviewTrainingPrompt).toMatch(/do not call set_ftp/i)
    expect(reviewTrainingPrompt).toContain('averageWatts')
    expect(reviewTrainingPrompt).not.toMatch(/0\.85/)
  })
})

describe('create_workout coaching copy', () => {
  it('tells the model that a zone number is the band midpoint', () => {
    expect(createWorkoutToolDescription).toMatch(/percentFtp/)
    expect(createWorkoutToolDescription).toMatch(/zone 3 is not sweet spot/i)
    expect(workoutStepZoneDescription).toMatch(/only 1-2/i)
    expect(workoutStepZoneDescription).toMatch(/do not use 6 or 7/i)
  })
})
