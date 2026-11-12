// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { initialPowerMeterSnapshot } from './cps'
import { initialCadenceSnapshot } from './csc'
import { initialSnapshot } from './ftms'
import { initialHeartRateSnapshot } from './hrm'
import { LiveDisplay } from './LiveDisplay'
import type { RunnerSnapshot } from './workout/workoutRunner'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const noop = () => undefined

function runner(freeRideFromSec: number | null, status: RunnerSnapshot['status']): RunnerSnapshot {
  return {
    status,
    workoutId: freeRideFromSec === null ? 'w1' : null,
    workoutName: freeRideFromSec === null ? 'Short' : 'Free Ride',
    stepIndex: 0,
    stepCount: freeRideFromSec === null ? 3 : 0,
    stepType: freeRideFromSec === null ? 'steady' : null,
    stepPlannedWatts: freeRideFromSec === null ? 200 : null,
    stepTargetWatts: 80,
    intensityPercent: 100,
    stepRemainingSec: freeRideFromSec === null ? 4 : 0,
    elapsedSec: freeRideFromSec === null ? 16 : freeRideFromSec + 30,
    totalSec: freeRideFromSec === null ? 20 : 0,
    targetChanged: false,
    openStepBlocked: false,
    freeRideFromSec,
  }
}

function renderRide(snap: RunnerSnapshot): { host: HTMLDivElement; root: Root } {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  act(() => {
    root.render(
      <LiveDisplay
        snapshot={{
          ...initialSnapshot(),
          webBluetoothSupported: true,
          knownDevicesChecked: true,
        }}
        meter={initialPowerMeterSnapshot()}
        alignmentDelta={null}
        powerSourceMode="trainer"
        heartRate={initialHeartRateSnapshot()}
        cadence={initialCadenceSnapshot()}
        workouts={[]}
        todaysScheduled={[]}
        selectedWorkoutId=""
        selectedScheduledRideId={null}
        runner={snap}
        plannedProfile={[]}
        targetProfile={null}
        achievedProfile={[]}
        saveMessage={null}
        ftpWatts={200}
        onSelectWorkout={noop}
        onOpenDevices={noop}
        onStart={noop}
        onPause={noop}
        onResume={noop}
        onSkip={noop}
        onStop={noop}
        onContinueAsFreeRide={noop}
        onRideAdjust={noop}
      />,
    )
  })
  return { host, root }
}

let mounted: { host: HTMLDivElement; root: Root } | null = null

afterEach(() => {
  if (!mounted) return
  act(() => mounted?.root.unmount())
  mounted.host.remove()
  mounted = null
})

describe('Continue as Free Ride note', () => {
  it('shows on the riding HUD when the Workout has ended and the ride is still recording', () => {
    mounted = renderRide(runner(960, 'running'))
    const hud = mounted.host.querySelector('.live-metrics-hud')
    expect(hud?.textContent).toContain('Workout ended at 16:00')
    expect(hud?.textContent).toContain('Stop saves it all as one ride')
  })

  it('stays off during a Workout and after Stop', () => {
    mounted = renderRide(runner(null, 'running'))
    expect(mounted.host.textContent).not.toContain('Workout ended at')

    act(() => mounted?.root.unmount())
    mounted.host.remove()
    mounted = renderRide(runner(960, 'stopped'))
    expect(mounted.host.textContent).not.toContain('Workout ended at')
  })
})
