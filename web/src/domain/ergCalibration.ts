export type ErgCalibration = {
  /**
   * Kept at 1. Open-loop ERG is target / scale + offset, and the learned
   * correction is the watt offset (trainer − meter), not a ratio.
   */
  scale: number
  offsetWatts: number
}

export const DEFAULT_ERG_CALIBRATION: ErgCalibration = {
  scale: 1,
  offsetWatts: 0,
}

/** Include warmup through interval targets; ignore spin-up and spike noise. */
const STEADY_METER_MIN = 70
const STEADY_METER_MAX = 450
/** Second-to-second move larger than this is an unsettled dip, not a new gap. */
const SETTLE_WATTS = 30
const OFFSET_MIN = -100
const OFFSET_MAX = 100

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

export type ResolveErgSetpointInput = {
  meterTargetWatts: number
  calibration: ErgCalibration
  meterWatts: number | null
  meterFresh: boolean
  /** Fraction of Assioma error applied as trim (default 0.7). */
  trimGain?: number
  /** Max |trim| watts (default 25). */
  maxTrimWatts?: number
}

/** Default closed-loop trim: strong enough to close ~20 W Assioma shortfalls. */
export const DEFAULT_ERG_TRIM_GAIN = 0.7
export const DEFAULT_ERG_MAX_TRIM_WATTS = 25

/** Hybrid ERG: calibration open-loop + Assioma trim when meter fresh. */
export function resolveErgSetpoint(input: ResolveErgSetpointInput): number {
  const scale =
    Number.isFinite(input.calibration.scale) && input.calibration.scale > 0
      ? input.calibration.scale
      : 1
  const offset = Number.isFinite(input.calibration.offsetWatts)
    ? input.calibration.offsetWatts
    : 0
  const openLoop = input.meterTargetWatts / scale + offset

  const trimGain = input.trimGain ?? DEFAULT_ERG_TRIM_GAIN
  const maxTrim = input.maxTrimWatts ?? DEFAULT_ERG_MAX_TRIM_WATTS
  let trim = 0
  if (
    input.meterFresh &&
    input.meterWatts !== null &&
    Number.isFinite(input.meterWatts)
  ) {
    const error = input.meterTargetWatts - input.meterWatts
    trim = clamp(error * trimGain, -maxTrim, maxTrim)
  }

  return Math.round(clamp(openLoop + trim, 0, 2500))
}

export type ErgAdaptSample = {
  meterWatts: number
  trainerWatts: number
}

/** Previous paired sample so a one-second dip is not treated as a new gap. */
export type ErgAdaptMemory = {
  previous: ErgAdaptSample | null
}

export type AdaptErgCalibrationOptions = {
  alpha?: number
  memory?: ErgAdaptMemory
}

function inSteadyBand(sample: ErgAdaptSample): boolean {
  return (
    Number.isFinite(sample.meterWatts) &&
    Number.isFinite(sample.trainerWatts) &&
    sample.meterWatts >= STEADY_METER_MIN &&
    sample.meterWatts <= STEADY_METER_MAX &&
    sample.trainerWatts > 0
  )
}

function isSettled(memory: ErgAdaptMemory, sample: ErgAdaptSample): boolean {
  const previous = memory.previous
  if (!previous) return false
  return (
    Math.abs(sample.meterWatts - previous.meterWatts) <= SETTLE_WATTS &&
    Math.abs(sample.trainerWatts - previous.trainerWatts) <= SETTLE_WATTS
  )
}

/**
 * Learn the trainer−meter watt gap. Scale stays 1 so a 22 W gap at 90 W
 * is still 22 W at 185 W. A stored ratio (scale ≠ 1, offset 0) converts
 * on the first steady sample.
 */
export function adaptErgCalibration(
  current: ErgCalibration,
  sample: ErgAdaptSample,
  options: AdaptErgCalibrationOptions = {},
): ErgCalibration {
  const memory = options.memory
  if (memory) {
    const settled = inSteadyBand(sample) && isSettled(memory, sample)
    memory.previous = sample
    if (!settled) return current
  } else if (!inSteadyBand(sample)) {
    return current
  }

  const convertingRatio = current.scale !== 1 && current.offsetWatts === 0
  const alpha = convertingRatio ? 1 : (options.alpha ?? 0.02)
  const observed = sample.trainerWatts - sample.meterWatts
  const offsetWatts = clamp(
    (1 - alpha) * current.offsetWatts + alpha * observed,
    OFFSET_MIN,
    OFFSET_MAX,
  )
  return { scale: 1, offsetWatts }
}
