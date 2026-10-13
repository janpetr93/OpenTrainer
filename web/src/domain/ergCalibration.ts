export type ErgCalibration = {
  /** Typical Meter/Trainer ratio (e.g. 0.85). Open-loop ERG = target / scale + offset. */
  scale: number
  offsetWatts: number
}

export const DEFAULT_ERG_CALIBRATION: ErgCalibration = {
  scale: 1,
  offsetWatts: 0,
}

/** Include easy warmup targets (~90 W); ignore very low spin-up noise. */
const STEADY_METER_MIN = 70
const STEADY_METER_MAX = 180
const SCALE_MIN = 0.5
const SCALE_MAX = 1.5

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

export type AdaptErgCalibrationOptions = {
  alpha?: number
}

/** Slow-adapt scale from a steady paired sample (Meter/Trainer). */
export function adaptErgCalibration(
  current: ErgCalibration,
  sample: { meterWatts: number; trainerWatts: number },
  options: AdaptErgCalibrationOptions = {},
): ErgCalibration {
  const { meterWatts, trainerWatts } = sample
  if (
    !Number.isFinite(meterWatts) ||
    !Number.isFinite(trainerWatts) ||
    meterWatts < STEADY_METER_MIN ||
    meterWatts > STEADY_METER_MAX ||
    trainerWatts <= 0
  ) {
    return current
  }

  const alpha = options.alpha ?? 0.02
  const observed = clamp(meterWatts / trainerWatts, SCALE_MIN, SCALE_MAX)
  const scale = clamp(
    (1 - alpha) * current.scale + alpha * observed,
    SCALE_MIN,
    SCALE_MAX,
  )
  return {
    scale,
    offsetWatts: current.offsetWatts,
  }
}
