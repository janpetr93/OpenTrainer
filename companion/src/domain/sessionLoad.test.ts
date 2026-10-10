import { describe, expect, it } from 'vitest'
import { computeSessionLoad } from './sessionLoad.js'
import type { PowerProfilePoint } from './types.js'

function steadyProfile(watts: number, durationSec: number): PowerProfilePoint[] {
  return Array.from({ length: durationSec }, (_, tSec) => ({ tSec, watts }))
}

describe('computeSessionLoad', () => {
  it('returns null when FTP is missing', () => {
    expect(computeSessionLoad(steadyProfile(200, 60), null)).toBeNull()
  })

  it('computes NP close to constant power and IF/TSS from FTP', () => {
    const load = computeSessionLoad(steadyProfile(200, 600), 200)
    expect(load).not.toBeNull()
    expect(load!.ftpWattsAtSave).toBe(200)
    expect(load!.normalizedPowerWatts).toBe(200)
    expect(load!.intensityFactor).toBe(1)
    // TSS = (sec * NP * IF) / (FTP * 3600) * 100 = 600/3600 * 100 = 16.67
    expect(load!.trainingStressScore).toBeCloseTo(16.67, 1)
  })

  it('leaves NP/IF/TSS null when ride shorter than 30s but still counts zones', () => {
    const load = computeSessionLoad(steadyProfile(100, 20), 200)
    expect(load).not.toBeNull()
    expect(load!.normalizedPowerWatts).toBeNull()
    expect(load!.intensityFactor).toBeNull()
    expect(load!.trainingStressScore).toBeNull()
    expect(load!.timeInZonesSec[1]).toBe(20)
  })
})
