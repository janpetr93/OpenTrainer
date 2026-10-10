/**
 * Instantaneous cadence from CSC crank revolution deltas.
 * Event time is in 1/1024 second units (uint16 wrap).
 */
export function cadenceRpmFromCrankDelta(input: {
  revDelta: number
  timeDeltaTicks: number
}): number | null {
  if (input.timeDeltaTicks <= 0 || input.revDelta <= 0) return null
  return (input.revDelta * 1024 * 60) / input.timeDeltaTicks
}

export function uint16Delta(current: number, previous: number): number {
  return (current - previous + 0x10000) % 0x10000
}
