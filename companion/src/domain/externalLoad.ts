import type { ExternalLoadEffort } from './types.js'

export type ExternalLoadMethod = 'override' | 'rTSS' | 'hrTSS' | 'duration'

export type ExternalLoadInput = {
  durationMin: number
  /** Manual override — rare. */
  trainingStressScore?: number | null
  averagePaceSecPerKm?: number | null
  averageHrBpm?: number | null
  runThresholdPaceSecPerKm?: number | null
  lthrBpm?: number | null
  effort?: ExternalLoadEffort | null
}

export type ExternalLoadResult = {
  trainingStressScore: number
  method: ExternalLoadMethod
}

const EFFORT_FACTOR: Record<ExternalLoadEffort, number> = {
  easy: 0.6,
  steady: 0.8,
  hard: 1.1,
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/**
 * TSS ≈ durationHours × IF² × 100.
 * Pace IF = thresholdSecPerKm / avgSecPerKm (faster = higher IF).
 * HR IF = avgHr / LTHR.
 */
export function computeExternalLoad(
  input: ExternalLoadInput,
): ExternalLoadResult {
  if (
    input.trainingStressScore != null &&
    Number.isFinite(input.trainingStressScore) &&
    input.trainingStressScore > 0
  ) {
    return {
      trainingStressScore: round1(input.trainingStressScore),
      method: 'override',
    }
  }

  if (
    !(
      Number.isFinite(input.durationMin) &&
      input.durationMin > 0
    )
  ) {
    throw new Error('durationMin must be a positive number')
  }

  const hours = input.durationMin / 60

  const threshold = input.runThresholdPaceSecPerKm
  const avgPace = input.averagePaceSecPerKm
  if (
    threshold != null &&
    avgPace != null &&
    threshold > 0 &&
    avgPace > 0
  ) {
    const intensity = threshold / avgPace
    return {
      trainingStressScore: round1(hours * intensity * intensity * 100),
      method: 'rTSS',
    }
  }

  const lthr = input.lthrBpm
  const avgHr = input.averageHrBpm
  if (lthr != null && avgHr != null && lthr > 0 && avgHr > 0) {
    const intensity = avgHr / lthr
    return {
      trainingStressScore: round1(hours * intensity * intensity * 100),
      method: 'hrTSS',
    }
  }

  const effort = input.effort ?? 'steady'
  const factor = EFFORT_FACTOR[effort] ?? EFFORT_FACTOR.steady
  return {
    trainingStressScore: round1(input.durationMin * factor),
    method: 'duration',
  }
}

export function externalLoadLabelSuffix(method: ExternalLoadMethod): string {
  switch (method) {
    case 'rTSS':
      return 'rTSS'
    case 'hrTSS':
      return 'hrTSS'
    case 'duration':
      return 'duration est'
    case 'override':
      return 'override'
  }
}
