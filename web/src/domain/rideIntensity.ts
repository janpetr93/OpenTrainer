import type { PowerProfilePoint } from '../api'

/**
 * Ride Intensity: a rider-set percent applied to a Workout's planned targets
 * mid-ride (100 = as planned). A Free Ride sets target watts instead.
 * See docs/decisions/2026-11-04-ride-intensity-and-free-ride-targets.md.
 */
export const DEFAULT_INTENSITY_PERCENT = 100
export const MIN_INTENSITY_PERCENT = 50
export const MAX_INTENSITY_PERCENT = 150
export const INTENSITY_SMALL_STEP = 1
export const INTENSITY_BIG_STEP = 5

export const MIN_FREE_RIDE_TARGET_WATTS = 30
export const MAX_FREE_RIDE_TARGET_WATTS = 1500
export const FREE_RIDE_SMALL_STEP_WATTS = 5
export const FREE_RIDE_BIG_STEP_WATTS = 25
const FREE_RIDE_FALLBACK_WATTS = 100
const FREE_RIDE_FTP_SEED_FRACTION = 0.6

/** Ride Intensity set at an elapsed second; holds until the next change. */
export type IntensityChange = { tSec: number; percent: number }

/** Free Ride target set at an elapsed second; holds until the next one. */
export type FreeRideTargetChange = { tSec: number; watts: number }

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function roundTo5(watts: number): number {
  return Math.round(watts / 5) * 5
}

export function clampIntensityPercent(percent: number): number {
  if (!Number.isFinite(percent)) return DEFAULT_INTENSITY_PERCENT
  return clamp(Math.round(percent), MIN_INTENSITY_PERCENT, MAX_INTENSITY_PERCENT)
}

export function nudgeIntensityPercent(current: number, delta: number): number {
  return clampIntensityPercent(current + delta)
}

export function scaleTargetWatts(plannedWatts: number, percent: number): number {
  return Math.round((plannedWatts * percent) / 100)
}

export function clampFreeRideTargetWatts(watts: number): number {
  if (!Number.isFinite(watts)) return FREE_RIDE_FALLBACK_WATTS
  return clamp(
    Math.round(watts),
    MIN_FREE_RIDE_TARGET_WATTS,
    MAX_FREE_RIDE_TARGET_WATTS,
  )
}

/** Where the first Free Ride nudge starts: current power, else 60% FTP, else 100 W. */
export function freeRideSeedWatts(input: {
  liveWatts: number | null
  ftpWatts: number | null
}): number {
  if (
    input.liveWatts !== null &&
    Number.isFinite(input.liveWatts) &&
    input.liveWatts >= MIN_FREE_RIDE_TARGET_WATTS
  ) {
    return clampFreeRideTargetWatts(roundTo5(input.liveWatts))
  }
  if (input.ftpWatts !== null && input.ftpWatts > 0) {
    return clampFreeRideTargetWatts(
      roundTo5(input.ftpWatts * FREE_RIDE_FTP_SEED_FRACTION),
    )
  }
  return FREE_RIDE_FALLBACK_WATTS
}

export function nudgeFreeRideTarget(
  current: number | null,
  deltaWatts: number,
  seedWatts: number,
): number {
  return clampFreeRideTargetWatts((current ?? seedWatts) + deltaWatts)
}

function percentAt(changes: readonly IntensityChange[], tSec: number): number {
  let percent = DEFAULT_INTENSITY_PERCENT
  for (const change of changes) {
    if (change.tSec <= tSec) percent = change.percent
    else break
  }
  return percent
}

/**
 * Planned step-corner Power Profile with the Ride Intensity in force at each
 * moment applied. A change mid-step splits that step; later steps take the
 * latest intensity. With no changes the plan comes back unchanged.
 */
export function applyIntensityToProfile(
  planned: readonly PowerProfilePoint[],
  changes: readonly IntensityChange[],
): PowerProfilePoint[] {
  if (changes.length === 0) {
    return planned.map((p) => ({ tSec: p.tSec, watts: p.watts }))
  }
  // Stable sort keeps the later of two changes in the same second last.
  const ordered = [...changes].sort((a, b) => a.tSec - b.tSec)
  const out: PowerProfilePoint[] = []
  for (let i = 0; i < planned.length - 1; i++) {
    const start = planned[i]!
    const end = planned[i + 1]!
    if (end.tSec <= start.tSec) continue
    const cuts = [
      start.tSec,
      ...ordered
        .map((c) => c.tSec)
        .filter((t) => t > start.tSec && t < end.tSec),
      end.tSec,
    ]
    for (let c = 0; c < cuts.length - 1; c++) {
      const from = cuts[c]!
      const to = cuts[c + 1]!
      if (to <= from) continue
      const watts = scaleTargetWatts(start.watts, percentAt(ordered, from))
      out.push({ tSec: from, watts }, { tSec: to, watts })
    }
  }
  return out
}

/** Step corners for the Free Ride targets, from the first one to `endSec`. */
export function freeRideTargetProfile(
  changes: readonly FreeRideTargetChange[],
  endSec: number,
): PowerProfilePoint[] {
  const out: PowerProfilePoint[] = []
  for (let i = 0; i < changes.length; i++) {
    const from = changes[i]!.tSec
    const to = i + 1 < changes.length ? changes[i + 1]!.tSec : endSec
    if (to <= from) continue
    const watts = changes[i]!.watts
    out.push({ tSec: from, watts }, { tSec: to, watts })
  }
  return out
}

export type RideKeyMode = 'workout' | 'freeRide'

export type RideKeyAction =
  | { kind: 'nudge'; delta: number }
  | { kind: 'reset' }

export type RideKeyInput = {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  repeat: boolean
}

/**
 * Keyboard shortcuts while riding: ↑/↓ or +/− small step, Shift+↑/↓ or
 * PageUp/PageDown big step, R resets a Workout to 100%. Held keys and
 * modifier chords are ignored so a stuck key cannot run the target away.
 */
export function rideKeyAction(
  input: RideKeyInput,
  mode: RideKeyMode,
): RideKeyAction | null {
  if (input.ctrlKey || input.metaKey || input.altKey || input.repeat) {
    return null
  }
  const small =
    mode === 'workout' ? INTENSITY_SMALL_STEP : FREE_RIDE_SMALL_STEP_WATTS
  const big = mode === 'workout' ? INTENSITY_BIG_STEP : FREE_RIDE_BIG_STEP_WATTS
  switch (input.key) {
    case 'ArrowUp':
      return { kind: 'nudge', delta: input.shiftKey ? big : small }
    case 'ArrowDown':
      return { kind: 'nudge', delta: -(input.shiftKey ? big : small) }
    case '+':
    case '=':
      return { kind: 'nudge', delta: small }
    case '-':
      return { kind: 'nudge', delta: -small }
    case 'PageUp':
      return { kind: 'nudge', delta: big }
    case 'PageDown':
      return { kind: 'nudge', delta: -big }
    case 'r':
    case 'R':
      return mode === 'workout' ? { kind: 'reset' } : null
    default:
      return null
  }
}
