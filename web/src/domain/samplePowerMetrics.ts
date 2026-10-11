import type { PowerSourceMode } from './powerSourceMode'

export type SamplePowerMetricsInput = {
  mode: PowerSourceMode
  trainerWatts: number | null
  trainerFresh: boolean
  meterWatts: number | null
  meterFresh: boolean
}

export type SamplePowerMetricsResult = {
  watts: number | null
  /** Trainer stream when meter-primary (secondary). */
  trainerWatts: number | null
  /** Meter stream when trainer-primary (comparison-only). */
  meterWatts: number | null
}

/** Map device streams into PowerSampler fields for the session Power Source Mode. */
export function samplePowerMetrics(
  input: SamplePowerMetricsInput,
): SamplePowerMetricsResult {
  const trainer =
    input.trainerFresh && input.trainerWatts !== null ? input.trainerWatts : null
  const meter =
    input.meterFresh && input.meterWatts !== null ? input.meterWatts : null

  if (input.mode === 'meter') {
    return {
      watts: meter,
      trainerWatts: trainer,
      meterWatts: null,
    }
  }

  return {
    watts: trainer,
    trainerWatts: null,
    meterWatts: meter,
  }
}
