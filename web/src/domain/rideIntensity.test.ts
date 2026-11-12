import { describe, expect, it } from 'vitest'
import {
  applyIntensityToProfile,
  clampIntensityPercent,
  freeRideSeedWatts,
  freeRideTargetProfile,
  nudgeFreeRideTarget,
  nudgeIntensityPercent,
  rideKeyAction,
  scaleTargetWatts,
} from './rideIntensity'

const plan = [
  { tSec: 0, watts: 140 },
  { tSec: 60, watts: 140 },
  { tSec: 60, watts: 280 },
  { tSec: 120, watts: 280 },
  { tSec: 120, watts: 100 },
  { tSec: 180, watts: 100 },
]

describe('clampIntensityPercent', () => {
  it('keeps whole percents between 50 and 150', () => {
    expect(clampIntensityPercent(80)).toBe(80)
    expect(clampIntensityPercent(80.4)).toBe(80)
    expect(clampIntensityPercent(20)).toBe(50)
    expect(clampIntensityPercent(400)).toBe(150)
    expect(clampIntensityPercent(Number.NaN)).toBe(100)
  })
})

describe('nudgeIntensityPercent', () => {
  it('steps and clamps', () => {
    expect(nudgeIntensityPercent(100, -5)).toBe(95)
    expect(nudgeIntensityPercent(100, 1)).toBe(101)
    expect(nudgeIntensityPercent(52, -5)).toBe(50)
    expect(nudgeIntensityPercent(148, 5)).toBe(150)
  })
})

describe('scaleTargetWatts', () => {
  it('rounds the scaled watts', () => {
    expect(scaleTargetWatts(280, 80)).toBe(224)
    expect(scaleTargetWatts(281, 95)).toBe(267)
    expect(scaleTargetWatts(140, 100)).toBe(140)
  })
})

describe('applyIntensityToProfile', () => {
  it('returns the plan unchanged when there are no changes', () => {
    expect(applyIntensityToProfile(plan, [])).toEqual(plan)
  })

  it('scales the current step from the change and every later step', () => {
    expect(applyIntensityToProfile(plan, [{ tSec: 75, percent: 80 }])).toEqual([
      { tSec: 0, watts: 140 },
      { tSec: 60, watts: 140 },
      { tSec: 60, watts: 280 },
      { tSec: 75, watts: 280 },
      { tSec: 75, watts: 224 },
      { tSec: 120, watts: 224 },
      { tSec: 120, watts: 80 },
      { tSec: 180, watts: 80 },
    ])
  })

  it('applies a change at a step boundary to the next step only', () => {
    expect(applyIntensityToProfile(plan, [{ tSec: 60, percent: 90 }])).toEqual([
      { tSec: 0, watts: 140 },
      { tSec: 60, watts: 140 },
      { tSec: 60, watts: 252 },
      { tSec: 120, watts: 252 },
      { tSec: 120, watts: 90 },
      { tSec: 180, watts: 90 },
    ])
  })

  it('follows several changes and a return to 100%', () => {
    expect(
      applyIntensityToProfile(plan, [
        { tSec: 30, percent: 90 },
        { tSec: 90, percent: 100 },
      ]),
    ).toEqual([
      { tSec: 0, watts: 140 },
      { tSec: 30, watts: 140 },
      { tSec: 30, watts: 126 },
      { tSec: 60, watts: 126 },
      { tSec: 60, watts: 252 },
      { tSec: 90, watts: 252 },
      { tSec: 90, watts: 280 },
      { tSec: 120, watts: 280 },
      { tSec: 120, watts: 100 },
      { tSec: 180, watts: 100 },
    ])
  })

  it('uses the last change when two share a second', () => {
    expect(
      applyIntensityToProfile(plan, [
        { tSec: 0, percent: 80 },
        { tSec: 0, percent: 95 },
      ]),
    ).toEqual([
      { tSec: 0, watts: 133 },
      { tSec: 60, watts: 133 },
      { tSec: 60, watts: 266 },
      { tSec: 120, watts: 266 },
      { tSec: 120, watts: 95 },
      { tSec: 180, watts: 95 },
    ])
  })
})

describe('freeRideTargetProfile', () => {
  it('is empty with no targets', () => {
    expect(freeRideTargetProfile([], 100)).toEqual([])
  })

  it('holds each target from when it was set until the next one or the end', () => {
    expect(
      freeRideTargetProfile(
        [
          { tSec: 30, watts: 150 },
          { tSec: 90, watts: 175 },
        ],
        120,
      ),
    ).toEqual([
      { tSec: 30, watts: 150 },
      { tSec: 90, watts: 150 },
      { tSec: 90, watts: 175 },
      { tSec: 120, watts: 175 },
    ])
  })

  it('drops a target set at the very end', () => {
    expect(freeRideTargetProfile([{ tSec: 40, watts: 150 }], 40)).toEqual([])
  })
})

describe('freeRideSeedWatts', () => {
  it('starts from live power rounded to 5 W', () => {
    expect(freeRideSeedWatts({ liveWatts: 153, ftpWatts: 280 })).toBe(155)
  })

  it('falls back to 60% FTP, then 100 W', () => {
    expect(freeRideSeedWatts({ liveWatts: null, ftpWatts: 280 })).toBe(170)
    expect(freeRideSeedWatts({ liveWatts: 0, ftpWatts: null })).toBe(100)
  })
})

describe('nudgeFreeRideTarget', () => {
  it('starts from the seed when no target is set yet', () => {
    expect(nudgeFreeRideTarget(null, 5, 150)).toBe(155)
  })

  it('steps and clamps an existing target', () => {
    expect(nudgeFreeRideTarget(200, -25, 150)).toBe(175)
    expect(nudgeFreeRideTarget(40, -25, 150)).toBe(30)
    expect(nudgeFreeRideTarget(1490, 25, 150)).toBe(1500)
  })
})

describe('rideKeyAction', () => {
  const key = (k: string, extra: Partial<Parameters<typeof rideKeyAction>[0]> = {}) => ({
    key: k,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    repeat: false,
    ...extra,
  })

  it('maps arrows and +/- to small steps for a Workout', () => {
    expect(rideKeyAction(key('ArrowUp'), 'workout')).toEqual({ kind: 'nudge', delta: 1 })
    expect(rideKeyAction(key('ArrowDown'), 'workout')).toEqual({ kind: 'nudge', delta: -1 })
    expect(rideKeyAction(key('+', { shiftKey: true }), 'workout')).toEqual({ kind: 'nudge', delta: 1 })
    expect(rideKeyAction(key('-'), 'workout')).toEqual({ kind: 'nudge', delta: -1 })
  })

  it('maps Shift+arrows and PageUp/PageDown to big steps', () => {
    expect(rideKeyAction(key('ArrowUp', { shiftKey: true }), 'workout')).toEqual({ kind: 'nudge', delta: 5 })
    expect(rideKeyAction(key('PageDown'), 'workout')).toEqual({ kind: 'nudge', delta: -5 })
  })

  it('steps watts in a Free Ride', () => {
    expect(rideKeyAction(key('ArrowUp'), 'freeRide')).toEqual({ kind: 'nudge', delta: 5 })
    expect(rideKeyAction(key('ArrowDown', { shiftKey: true }), 'freeRide')).toEqual({ kind: 'nudge', delta: -25 })
  })

  it('resets a Workout with R but not a Free Ride', () => {
    expect(rideKeyAction(key('r'), 'workout')).toEqual({ kind: 'reset' })
    expect(rideKeyAction(key('R', { shiftKey: true }), 'workout')).toEqual({ kind: 'reset' })
    expect(rideKeyAction(key('r'), 'freeRide')).toBeNull()
  })

  it('pauses and resumes with Space in a Workout and a Free Ride', () => {
    expect(rideKeyAction(key(' '), 'workout')).toEqual({ kind: 'togglePause' })
    expect(rideKeyAction(key(' '), 'freeRide')).toEqual({ kind: 'togglePause' })
    expect(rideKeyAction(key(' ', { repeat: true }), 'workout')).toBeNull()
    expect(rideKeyAction(key(' ', { metaKey: true }), 'workout')).toBeNull()
  })

  it('ignores modifiers, auto-repeat and other keys', () => {
    expect(rideKeyAction(key('ArrowUp', { ctrlKey: true }), 'workout')).toBeNull()
    expect(rideKeyAction(key('ArrowUp', { metaKey: true }), 'workout')).toBeNull()
    expect(rideKeyAction(key('ArrowUp', { altKey: true }), 'workout')).toBeNull()
    expect(rideKeyAction(key('ArrowUp', { repeat: true }), 'workout')).toBeNull()
    expect(rideKeyAction(key('a'), 'workout')).toBeNull()
  })
})
