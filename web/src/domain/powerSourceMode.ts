export type PowerSourceMode = 'meter' | 'trainer'

/** Choose Power Source Mode at Start from Power Meter freshness. */
export function resolvePowerSourceMode(input: {
  meterFresh: boolean
}): PowerSourceMode {
  return input.meterFresh ? 'meter' : 'trainer'
}
