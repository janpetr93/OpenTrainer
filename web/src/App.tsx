import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getRiderProfile,
  listScheduledRides,
  listWorkouts,
  saveActivity,
  type PowerProfilePoint,
  type RiderProfile,
  type ScheduledRide,
  type Workout,
} from './api'
import { dayRangeIso } from './calendar/monthGrid'
import { scheduledRidesForLocalDay } from './calendar/todaysScheduledRides'
import { buildPlannedPowerProfile } from './domain/plannedPowerProfile'
import { workoutNeedsFtp } from './domain/resolveTarget'
import {
  AlignmentDeltaAverager,
  PowerMeterConnection,
  type PowerMeterSnapshot,
} from './cps'
import { connectAllKnown } from './ble/connectAllKnown'
import { CadenceConnection, type CadenceSnapshot } from './csc'
import { TrainerConnection, type TrainerSnapshot } from './ftms'
import { HeartRateConnection, type HeartRateSnapshot } from './hrm'
import { APP_TAB_ORDER, initialAppTab, type AppTab } from './appTab'
import { CalendarPanel } from './CalendarPanel'
import { DevicesPanel } from './DevicesPanel'
import { LiveDisplay } from './LiveDisplay'
import { ProfilePanel } from './ProfilePanel'
import { WorkoutsPanel } from './WorkoutsPanel'
import { PowerSampler } from './workout/powerSampler'
import {
  WorkoutRunner,
  type RunnerSnapshot,
} from './workout/workoutRunner'
import './App.css'

function withResolvedPlan(workout: Workout, ftpWatts: number | null): Workout {
  return {
    ...workout,
    plannedPowerProfile: buildPlannedPowerProfile(workout.steps, ftpWatts),
  }
}

function App() {
  const connection = useMemo(() => new TrainerConnection(), [])
  const meterConnection = useMemo(() => new PowerMeterConnection(), [])
  const heartRateConnection = useMemo(() => new HeartRateConnection(), [])
  const cadenceConnection = useMemo(() => new CadenceConnection(), [])
  const runner = useMemo(() => new WorkoutRunner(), [])
  const sampler = useMemo(() => new PowerSampler(), [])
  const alignmentAverager = useMemo(() => new AlignmentDeltaAverager(), [])

  const [snapshot, setSnapshot] = useState<TrainerSnapshot>(() =>
    connection.getSnapshot(),
  )
  const [meter, setMeter] = useState<PowerMeterSnapshot>(() =>
    meterConnection.getSnapshot(),
  )
  const [alignmentDelta, setAlignmentDelta] = useState<number | null>(null)
  const [heartRate, setHeartRate] = useState<HeartRateSnapshot>(() =>
    heartRateConnection.getSnapshot(),
  )
  const [cadence, setCadence] = useState<CadenceSnapshot>(() =>
    cadenceConnection.getSnapshot(),
  )
  const [runnerSnap, setRunnerSnap] = useState<RunnerSnapshot>(() =>
    runner.getSnapshot(),
  )
  const [tab, setTab] = useState<AppTab>(() =>
    initialAppTab(window.location.search),
  )
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [todaysScheduled, setTodaysScheduled] = useState<ScheduledRide[]>([])
  const [selectedWorkoutId, setSelectedWorkoutId] = useState('')
  const [selectedPurpose, setSelectedPurpose] = useState<string | null>(null)
  const [activePurpose, setActivePurpose] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [connectAllSummary, setConnectAllSummary] = useState<string | null>(
    null,
  )
  const [achievedProfile, setAchievedProfile] = useState<PowerProfilePoint[]>(
    [],
  )
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null)
  const [profile, setProfile] = useState<RiderProfile | null>(null)
  const startedAtRef = useRef<string | null>(null)
  const savingRef = useRef(false)

  const ftpWatts = profile?.ftpWatts ?? null
  const selectedWorkout = workouts.find((w) => w.id === selectedWorkoutId)
  const plannedProfile =
    activeWorkout?.plannedPowerProfile ??
    (selectedWorkout
      ? buildPlannedPowerProfile(selectedWorkout.steps, ftpWatts)
      : [])

  const refreshRunner = useCallback(() => {
    setRunnerSnap(runner.getSnapshot())
  }, [runner])

  const applyErgIfNeeded = useCallback(async () => {
    const snap = runner.getSnapshot()
    if (!snap.targetChanged) return
    runner.clearTargetChanged()
    setRunnerSnap(runner.getSnapshot())
    if (snap.stepTargetWatts !== null && snapshot.ergControlAvailable) {
      await connection.setTargetPower(snap.stepTargetWatts)
    }
  }, [connection, runner, snapshot.ergControlAvailable])

  const finishAndSave = useCallback(async () => {
    if (savingRef.current) return
    savingRef.current = true
    const workout = activeWorkout
    const startedAt = startedAtRef.current ?? new Date().toISOString()
    const summary = sampler.summarize()
    const durationSec = Math.max(
      summary.durationSec,
      runner.getSnapshot().elapsedSec,
    )
    try {
      await saveActivity({
        startedAt,
        durationSec,
        averagePowerWatts: summary.averagePowerWatts,
        maxPowerWatts: summary.maxPowerWatts,
        achievedPowerProfile: sampler.getProfile(),
        plannedPowerProfile: workout?.plannedPowerProfile ?? null,
        workoutId: workout?.id ?? null,
        purpose: activePurpose,
      })
      setSaveMessage('Activity saved to Local Store.')
    } catch (error) {
      setSaveMessage(
        error instanceof Error
          ? `Could not save Activity: ${error.message}`
          : 'Could not save Activity',
      )
    } finally {
      savingRef.current = false
      setActiveWorkout(null)
      setActivePurpose(null)
      startedAtRef.current = null
      refreshRunner()
    }
  }, [runner, sampler, refreshRunner, activeWorkout, activePurpose])

  useEffect(() => connection.subscribe(setSnapshot), [connection])
  useEffect(() => meterConnection.subscribe(setMeter), [meterConnection])
  useEffect(
    () => heartRateConnection.subscribe(setHeartRate),
    [heartRateConnection],
  )
  useEffect(
    () => cadenceConnection.subscribe(setCadence),
    [cadenceConnection],
  )

  useEffect(() => {
    void connection.refreshKnownDevices()
    void meterConnection.refreshKnownDevices()
    void heartRateConnection.refreshKnownDevices()
    void cadenceConnection.refreshKnownDevices()
  }, [connection, meterConnection, heartRateConnection, cadenceConnection])

  useEffect(() => {
    const id = window.setInterval(() => {
      const trainer = connection.getSnapshot()
      const powerMeter = meterConnection.getSnapshot()
      setAlignmentDelta(
        alignmentAverager.sample({
          trainerWatts: trainer.watts,
          trainerStatus: trainer.powerStatus,
          meterWatts: powerMeter.watts,
          meterStatus: powerMeter.powerStatus,
          nowMs: Date.now(),
        }),
      )
    }, 250)
    return () => window.clearInterval(id)
  }, [connection, meterConnection, alignmentAverager])

  useEffect(() => {
    const release = () => {
      void connection.disconnect()
      void meterConnection.disconnect()
      void heartRateConnection.disconnect()
      void cadenceConnection.disconnect()
    }
    window.addEventListener('pagehide', release)
    return () => window.removeEventListener('pagehide', release)
  }, [connection, meterConnection, heartRateConnection, cadenceConnection])

  useEffect(() => {
    void getRiderProfile()
      .then(setProfile)
      .catch(() => {
        /* companion may be down */
      })
  }, [])

  useEffect(() => {
    if (tab !== 'ride') return
    void listWorkouts()
      .then((list) => {
        setWorkouts(list)
        setSelectedWorkoutId((current) => {
          const next =
            current && list.some((w) => w.id === current) ? current : ''
          if (!next) setSelectedPurpose(null)
          return next
        })
      })
      .catch(() => {
        /* companion may be down */
      })
    const range = dayRangeIso(new Date())
    void listScheduledRides(range)
      .then((rides) => {
        setTodaysScheduled(scheduledRidesForLocalDay(rides, new Date()))
      })
      .catch(() => {
        setTodaysScheduled([])
      })
  }, [tab])

  useEffect(() => {
    const id = window.setInterval(() => {
      const status = runner.getSnapshot().status
      if (status !== 'running' && status !== 'paused') return

      const now = Date.now()
      runner.tick(now)
      const snap = runner.getSnapshot()
      const trainer = connection.getSnapshot()
      const hr = heartRateConnection.getSnapshot()
      const cad = cadenceConnection.getSnapshot()
      const powerMeter = meterConnection.getSnapshot()
      const cadenceRpm =
        cad.connectionState === 'connected' &&
        cad.status === 'fresh' &&
        cad.rpm !== null
          ? cad.rpm
          : trainer.cadenceRpm !== null && trainer.powerStatus === 'fresh'
            ? Math.round(trainer.cadenceRpm)
            : null
      sampler.record(snap.elapsedSec, {
        watts: trainer.watts,
        hrBpm:
          hr.status === 'fresh' && hr.bpm !== null ? hr.bpm : null,
        cadenceRpm,
        meterWatts:
          powerMeter.powerStatus === 'fresh' && powerMeter.watts !== null
            ? powerMeter.watts
            : null,
      })
      setRunnerSnap(snap)
      setAchievedProfile(sampler.getProfile())

      if (snap.targetChanged) {
        void applyErgIfNeeded()
      }

      if (snap.status === 'completed') {
        void finishAndSave()
      }
    }, 250)
    return () => window.clearInterval(id)
  }, [
    runner,
    sampler,
    connection,
    meterConnection,
    heartRateConnection,
    cadenceConnection,
    applyErgIfNeeded,
    finishAndSave,
  ])

  function onStart(): void {
    setSaveMessage(null)
    sampler.reset()
    setAchievedProfile([])
    savingRef.current = false
    startedAtRef.current = new Date().toISOString()

    if (!selectedWorkoutId) {
      setActiveWorkout(null)
      setActivePurpose(null)
      runner.startFreeRide(Date.now())
      refreshRunner()
      return
    }

    const workout = workouts.find((w) => w.id === selectedWorkoutId)
    if (!workout) {
      setSaveMessage('Selected Workout not found — pick Today again or Free Ride.')
      return
    }
    if (workoutNeedsFtp(workout.steps) && (ftpWatts === null || ftpWatts <= 0)) {
      setSaveMessage(
        'Set FTP via MCP (set_ftp) before starting this Workout.',
      )
      return
    }
    const resolved = withResolvedPlan(workout, ftpWatts)
    setActiveWorkout(resolved)
    setActivePurpose(selectedPurpose)
    try {
      runner.start(resolved, Date.now(), ftpWatts)
    } catch (error) {
      setSaveMessage(
        error instanceof Error ? error.message : 'Could not start Workout',
      )
      setActiveWorkout(null)
      setActivePurpose(null)
      return
    }
    refreshRunner()
    void applyErgIfNeeded()
  }

  function onPause(): void {
    runner.pause(Date.now())
    refreshRunner()
  }

  function onResume(): void {
    runner.resume(Date.now())
    refreshRunner()
  }

  function onSkip(): void {
    runner.skip(Date.now())
    refreshRunner()
    void applyErgIfNeeded()
    if (runner.getSnapshot().status === 'completed') {
      void finishAndSave()
    }
  }

  function onStop(): void {
    runner.stop(Date.now())
    refreshRunner()
    void finishAndSave()
  }

  function onSelectWorkout(
    workoutId: string,
    purpose: string | null = null,
  ): void {
    setSelectedWorkoutId(workoutId)
    setSelectedPurpose(workoutId ? purpose : null)
  }

  function onStartScheduledWorkout(
    workoutId: string,
    purpose: string | null = null,
  ): void {
    onSelectWorkout(workoutId, purpose)
    setTab('ride')
    setSaveMessage(
      'Workout selected from calendar — connect on Devices, then Start on Ride.',
    )
  }

  async function onConnectAllKnown(): Promise<void> {
    const trainerSnap = connection.getSnapshot()
    const meterSnap = meterConnection.getSnapshot()
    const hrSnap = heartRateConnection.getSnapshot()
    const cadSnap = cadenceConnection.getSnapshot()
    const summary = await connectAllKnown([
      {
        label: 'trainer',
        connectionState: trainerSnap.connectionState,
        knownDeviceCount: trainerSnap.knownDevices.length,
        connect: () => connection.connect(),
        getConnectionState: () => connection.getSnapshot().connectionState,
      },
      {
        label: 'power meter',
        connectionState: meterSnap.connectionState,
        knownDeviceCount: meterSnap.knownDevices.length,
        connect: () => meterConnection.connect(),
        getConnectionState: () => meterConnection.getSnapshot().connectionState,
      },
      {
        label: 'heart rate',
        connectionState: hrSnap.connectionState,
        knownDeviceCount: hrSnap.knownDevices.length,
        connect: () => heartRateConnection.connect(),
        getConnectionState: () =>
          heartRateConnection.getSnapshot().connectionState,
      },
      {
        label: 'cadence',
        connectionState: cadSnap.connectionState,
        knownDeviceCount: cadSnap.knownDevices.length,
        connect: () => cadenceConnection.connect(),
        getConnectionState: () =>
          cadenceConnection.getSnapshot().connectionState,
      },
    ])
    setConnectAllSummary(summary)
  }

  async function onDisconnectAll(): Promise<void> {
    setConnectAllSummary(null)
    await connection.disconnect()
    await meterConnection.disconnect()
    await heartRateConnection.disconnect()
    await cadenceConnection.disconnect()
  }

  const riding =
    tab === 'ride' &&
    (runnerSnap.status === 'running' || runnerSnap.status === 'paused')

  const connectorHandlers = {
    trainer: {
      onConnect: () => void connection.connect(),
      onConnectDevice: (deviceId: string) =>
        void connection.connect({ deviceId }),
      onChooser: () => void connection.connect({ forceChooser: true }),
      onScanAll: () => void connection.connect({ acceptAllDevices: true }),
      onDisconnect: () => void connection.disconnect(),
      onReconnect: () => void connection.reconnect(),
    },
    powerMeter: {
      onConnect: () => void meterConnection.connect(),
      onConnectDevice: (deviceId: string) =>
        void meterConnection.connect({ deviceId }),
      onChooser: () => void meterConnection.connect({ forceChooser: true }),
      onScanAll: () =>
        void meterConnection.connect({ acceptAllDevices: true }),
      onDisconnect: () => void meterConnection.disconnect(),
      onReconnect: () => void meterConnection.reconnect(),
    },
    heartRateLink: {
      onConnect: () => void heartRateConnection.connect(),
      onConnectDevice: (deviceId: string) =>
        void heartRateConnection.connect({ deviceId }),
      onChooser: () =>
        void heartRateConnection.connect({ forceChooser: true }),
      onScanAll: () =>
        void heartRateConnection.connect({ acceptAllDevices: true }),
      onDisconnect: () => void heartRateConnection.disconnect(),
      onReconnect: () => void heartRateConnection.reconnect(),
    },
    cadenceLink: {
      onConnect: () => void cadenceConnection.connect(),
      onConnectDevice: (deviceId: string) =>
        void cadenceConnection.connect({ deviceId }),
      onChooser: () =>
        void cadenceConnection.connect({ forceChooser: true }),
      onScanAll: () =>
        void cadenceConnection.connect({ acceptAllDevices: true }),
      onDisconnect: () => void cadenceConnection.disconnect(),
      onReconnect: () => void cadenceConnection.reconnect(),
    },
  }

  const tabLabels: Record<AppTab, string> = {
    ride: 'Ride',
    devices: 'Devices',
    history: 'History',
    calendar: 'Calendar',
    profile: 'Profile',
  }

  return (
    <main className={riding ? 'app app-riding' : 'app'}>
      <nav className="tabs" aria-label="App sections">
        {APP_TAB_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'tab active' : 'tab'}
            onClick={() => setTab(id)}
          >
            {tabLabels[id]}
          </button>
        ))}
      </nav>

      {tab === 'ride' && (
        <LiveDisplay
          snapshot={snapshot}
          meter={meter}
          alignmentDelta={alignmentDelta}
          heartRate={heartRate}
          cadence={cadence}
          workouts={workouts}
          todaysScheduled={todaysScheduled}
          selectedWorkoutId={selectedWorkoutId}
          runner={runnerSnap}
          plannedProfile={plannedProfile}
          achievedProfile={achievedProfile}
          saveMessage={saveMessage}
          ftpWatts={ftpWatts}
          onSelectWorkout={onSelectWorkout}
          onOpenDevices={() => setTab('devices')}
          onStart={onStart}
          onPause={onPause}
          onResume={onResume}
          onSkip={onSkip}
          onStop={onStop}
        />
      )}
      {tab === 'devices' && (
        <DevicesPanel
          snapshot={snapshot}
          meter={meter}
          heartRate={heartRate}
          cadence={cadence}
          connectAllSummary={connectAllSummary}
          trainer={connectorHandlers.trainer}
          powerMeter={connectorHandlers.powerMeter}
          heartRateLink={connectorHandlers.heartRateLink}
          cadenceLink={connectorHandlers.cadenceLink}
          onConnectAllKnown={() => void onConnectAllKnown()}
          onDisconnectAll={() => void onDisconnectAll()}
        />
      )}
      {tab === 'history' && <WorkoutsPanel />}
      {tab === 'calendar' && (
        <CalendarPanel onStartScheduledWorkout={onStartScheduledWorkout} />
      )}
      {tab === 'profile' && (
        <ProfilePanel onProfileChange={setProfile} />
      )}
    </main>
  )
}

export default App
