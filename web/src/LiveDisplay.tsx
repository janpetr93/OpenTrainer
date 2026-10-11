import type { PowerProfilePoint, ScheduledRide, Workout } from './api'
import {
  formatAlignmentDelta,
  type PowerMeterSnapshot,
} from './cps'
import type { CadenceSnapshot } from './csc'
import { workoutNeedsFtp } from './domain/resolveTarget'
import {
  buildRideChartSeries,
  splitRideChartSeries,
} from './chart/metricSeries'
import type { TrainerSnapshot } from './ftms'
import type { HeartRateSnapshot } from './hrm'
import { PowerProfileLine } from './PowerProfileLine'
import { SessionModule } from './SessionModule'
import {
  chartFromScheduledWorkout,
  scheduledDurationLabel,
  scheduledOutcomeLabel,
  scheduledMeta,
  sessionTitle,
} from './session/sessionModuleHelpers'
import { PageHeader } from './PageHeader'
import { SensorStatusStrip } from './SensorStatusStrip'
import type { RunnerSnapshot } from './workout/workoutRunner'

type Props = {
  snapshot: TrainerSnapshot
  meter: PowerMeterSnapshot
  /** Rolling ~5s average of Meter − Trainer (null when window empty). */
  alignmentDelta: number | null
  heartRate: HeartRateSnapshot
  cadence: CadenceSnapshot
  workouts: Workout[]
  todaysScheduled: ScheduledRide[]
  selectedWorkoutId: string
  selectedScheduledRideId: string | null
  runner: RunnerSnapshot
  plannedProfile: PowerProfilePoint[]
  achievedProfile: PowerProfilePoint[]
  saveMessage: string | null
  ftpWatts: number | null
  onSelectWorkout: (
    id: string,
    purpose?: string | null,
    scheduledRideId?: string | null,
  ) => void
  onOpenDevices: () => void
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onSkip: () => void
  onStop: () => void
}

function powerLabel(snapshot: TrainerSnapshot): string {
  if (snapshot.powerStatus === 'missing') return '—'
  if (snapshot.watts === null) return '—'
  return String(snapshot.watts)
}

function powerHint(snapshot: TrainerSnapshot): string {
  switch (snapshot.powerStatus) {
    case 'missing':
      return 'No power data yet'
    case 'stale':
      return 'Stale — no recent power notification'
    case 'fresh':
      return 'Live Power (trainer)'
  }
}

function meterPowerLabel(meter: PowerMeterSnapshot): string {
  if (meter.powerStatus === 'missing' || meter.watts === null) return '—'
  return String(meter.watts)
}

function formatClock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function LiveDisplay({
  snapshot,
  meter,
  alignmentDelta,
  heartRate,
  cadence,
  workouts,
  todaysScheduled,
  selectedWorkoutId,
  selectedScheduledRideId,
  runner,
  plannedProfile,
  achievedProfile,
  saveMessage,
  ftpWatts,
  onSelectWorkout,
  onOpenDevices,
  onStart,
  onPause,
  onResume,
  onSkip,
  onStop,
}: Props) {
  const connected = snapshot.connectionState === 'connected'
  const meterConnected = meter.connectionState === 'connected'
  const hrConnected = heartRate.connectionState === 'connected'
  const cadenceConnected = cadence.connectionState === 'connected'
  const inWorkout =
    runner.status === 'running' ||
    runner.status === 'paused' ||
    runner.status === 'completed' ||
    runner.status === 'stopped'
  const selected = workouts.find((w) => w.id === selectedWorkoutId)
  const needsFtp = selected ? workoutNeedsFtp(selected.steps) : false
  const structuredReady =
    selectedWorkoutId !== '' &&
    (!needsFtp || (ftpWatts !== null && ftpWatts > 0))
  const canStart =
    connected &&
    (selectedWorkoutId === '' || structuredReady) &&
    (runner.status === 'idle' ||
      runner.status === 'completed' ||
      runner.status === 'stopped')
  const selectingLocked =
    runner.status === 'running' || runner.status === 'paused'
  const isFreeRide = runner.workoutId === null && runner.workoutName === 'Free Ride'
  const workoutName = (id: string) =>
    workouts.find((w) => w.id === id)?.name ?? 'Workout'
  const selectedFromToday = todaysScheduled.some(
    (ride) =>
      selectedScheduledRideId != null
        ? ride.id === selectedScheduledRideId
        : ride.workoutId === selectedWorkoutId,
  )
  const calendarSelection =
    selectedWorkoutId !== '' && !selectedFromToday ? selected : null
  const calendarChart = calendarSelection
    ? chartFromScheduledWorkout(calendarSelection, ftpWatts)
    : null

  function toggleRide(ride: ScheduledRide): void {
    if (ride.status === 'completed' || ride.status === 'skipped') return
    if (selectedScheduledRideId === ride.id) {
      onSelectWorkout('', null, null)
      return
    }
    onSelectWorkout(ride.workoutId, ride.purpose ?? null, ride.id)
  }

  const displayCadenceRpm =
    cadenceConnected && cadence.rpm !== null
      ? cadence.rpm
      : snapshot.cadenceRpm
  const displayCadenceSource =
    cadenceConnected && cadence.rpm !== null ? 'sensor' : 'trainer'
  const showSecondary =
    heartRate.bpm !== null ||
    displayCadenceRpm !== null ||
    snapshot.speedKmh !== null ||
    hrConnected ||
    cadenceConnected
  const rideSeries = buildRideChartSeries({
    planned: plannedProfile,
    achieved: achievedProfile,
  })
  const { power: powerSeries, body: bodySeries } =
    splitRideChartSeries(rideSeries)
  const showChart = powerSeries.length > 0
  const showBodyChart = bodySeries.length > 0
  const chartMaxTSec = plannedProfile.length
    ? Math.max(...plannedProfile.map((p) => p.tSec))
    : undefined
  /** Soft riding mode: setup collapses only while actively riding. */
  const riding =
    runner.status === 'running' || runner.status === 'paused'
  const chartCursorSec =
    riding || inWorkout ? runner.elapsedSec : null
  const sensors = [
    {
      id: 'trainer',
      label: 'Trainer',
      connectionState: snapshot.connectionState,
      deviceName: snapshot.deviceName,
    },
    {
      id: 'meter',
      label: 'Meter',
      connectionState: meter.connectionState,
      deviceName: meter.deviceName,
    },
    {
      id: 'hr',
      label: 'HR',
      connectionState: heartRate.connectionState,
      deviceName: heartRate.deviceName,
    },
    {
      id: 'cadence',
      label: 'Cadence',
      connectionState: cadence.connectionState,
      deviceName: cadence.deviceName,
    },
  ]

  return (
    <div className={`live-display${riding ? ' live-display-riding' : ''}`}>
      <PageHeader
        title="Ride"
        status={
          <div className="sensor-status-row">
            <SensorStatusStrip sensors={sensors} ftpWatts={ftpWatts} />
            <button
              type="button"
              className="linkish"
              onClick={onOpenDevices}
            >
              Manage on Devices
            </button>
          </div>
        }
      />

      {!snapshot.webBluetoothSupported && (
        <p className="banner warn">
          Web Bluetooth unavailable. Open this app in desktop Chrome or Edge on
          localhost.
        </p>
      )}

      {snapshot.lastError && <p className="banner error">{snapshot.lastError}</p>}
      {meter.lastError && <p className="banner error">{meter.lastError}</p>}
      {heartRate.lastError && (
        <p className="banner error">{heartRate.lastError}</p>
      )}
      {cadence.lastError && <p className="banner error">{cadence.lastError}</p>}
      {saveMessage && <p className="banner warn">{saveMessage}</p>}

      <section className="power-panel" aria-live="polite">
        {showChart && (
          <div className="ride-chart ride-chart-hero">
            <div className="ride-chart-stack">
              <PowerProfileLine
                className="ride-power-chart"
                label="Live power versus time with power zones"
                height={360}
                width={960}
                ftpWatts={ftpWatts}
                maxTSec={chartMaxTSec}
                cursorSec={chartCursorSec}
                series={powerSeries}
                showAxes
                hideXAxis={showBodyChart}
              />
              {showBodyChart && (
                <PowerProfileLine
                  className="ride-body-chart"
                  label="Heart rate and cadence versus time"
                  height={120}
                  width={960}
                  maxTSec={chartMaxTSec}
                  cursorSec={chartCursorSec}
                  series={bodySeries}
                  showAxes
                />
              )}
            </div>
            <p
              className={`chart-legend muted${riding ? ' chart-legend-compact' : ''}`}
            >
              {ftpWatts !== null && ftpWatts > 0 && (
                <span className="legend-zones">Zones</span>
              )}
              {rideSeries.map((s) => (
                <span
                  key={s.tone}
                  className={`legend-${s.tone}`}
                >
                  {s.label}
                </span>
              ))}
            </p>
            {ftpWatts === null || ftpWatts <= 0 ? (
              <p className="alignment-hint muted">
                Set FTP via MCP (set_ftp) to show Power Zone bands.
              </p>
            ) : null}
          </div>
        )}

        {riding ? (
          <div className="live-metrics-hud">
            {inWorkout && (
              <p className="workout-live-title live-metrics-hud-title">
                {isFreeRide || runner.stepCount === 0
                  ? 'Free Ride'
                  : `${runner.workoutName ?? 'Workout'} · step ${runner.stepIndex + 1}/${runner.stepCount}${runner.stepType ? ` · ${runner.stepType}` : ''}`}
              </p>
            )}

            <div className="live-metric-rail live-metric-rail-body">
              {(heartRate.bpm !== null || hrConnected) && (
                <div className="live-metric-tile" data-status={heartRate.status}>
                  <span className="live-metric-label">HR</span>
                  <span className="live-metric-value">
                    {heartRate.bpm === null ? '—' : heartRate.bpm}
                  </span>
                  <span className="live-metric-unit">bpm</span>
                </div>
              )}
              {(displayCadenceRpm !== null || cadenceConnected) && (
                <div
                  className="live-metric-tile"
                  data-status={
                    cadenceConnected ? cadence.status : snapshot.powerStatus
                  }
                  title={
                    displayCadenceSource === 'sensor'
                      ? 'Cadence sensor'
                      : 'Trainer cadence'
                  }
                >
                  <span className="live-metric-label">Cadence</span>
                  <span className="live-metric-value">
                    {displayCadenceRpm === null
                      ? '—'
                      : displayCadenceRpm.toFixed(0)}
                  </span>
                  <span className="live-metric-unit">rpm</span>
                </div>
              )}
              {snapshot.speedKmh !== null && (
                <div className="live-metric-tile">
                  <span className="live-metric-label">Speed</span>
                  <span className="live-metric-value">
                    {snapshot.speedKmh.toFixed(1)}
                  </span>
                  <span className="live-metric-unit">km/h</span>
                </div>
              )}
            </div>

            <div className="live-metric-primary">
              <p className="power-hint">{powerHint(snapshot)}</p>
              <p className="power-value" data-status={snapshot.powerStatus}>
                {powerLabel(snapshot)}
                <span className="power-unit">W</span>
              </p>
              {(meterConnected ||
                meter.connectionState === 'disconnected-with-reconnect' ||
                meter.deviceName !== null) && (
                <p
                  className="alignment-row alignment-row-compact"
                  data-status={meter.powerStatus}
                  title="Power Alignment · 5s avg · Meter − Trainer"
                >
                  <span className="alignment-label">Meter</span>
                  <span className="alignment-watts">
                    {meterPowerLabel(meter)}
                    <span className="power-unit">W</span>
                  </span>
                  <span className="alignment-delta">
                    Δ {formatAlignmentDelta(alignmentDelta)}
                  </span>
                </p>
              )}
            </div>

            <div className="live-metric-rail live-metric-rail-session">
              {inWorkout &&
                !(isFreeRide || runner.stepCount === 0) && (
                  <>
                    <div className="live-metric-tile">
                      <span className="live-metric-label">Target</span>
                      <span className="live-metric-value">
                        {runner.stepTargetWatts === null
                          ? '—'
                          : runner.stepTargetWatts}
                      </span>
                      <span className="live-metric-unit">W</span>
                    </div>
                    <div className="live-metric-tile">
                      <span className="live-metric-label">Left</span>
                      <span className="live-metric-value">
                        {formatClock(runner.stepRemainingSec)}
                      </span>
                    </div>
                  </>
                )}
              {inWorkout && (
                <div className="live-metric-tile">
                  <span className="live-metric-label">Elapsed</span>
                  <span className="live-metric-value">
                    {formatClock(runner.elapsedSec)}
                  </span>
                </div>
              )}
              {inWorkout &&
                !(isFreeRide || runner.stepCount === 0) &&
                !snapshot.ergControlAvailable && (
                  <p className="muted live-metric-note">
                    Display-only targets — trainer ERG not available.
                  </p>
                )}
            </div>
          </div>
        ) : (
          <>
            <div className="live-metrics-row">
              <div className="live-metric-primary">
                <p className="power-hint">{powerHint(snapshot)}</p>
                <p className="power-value" data-status={snapshot.powerStatus}>
                  {powerLabel(snapshot)}
                  <span className="power-unit">W</span>
                </p>
              </div>

              {showSecondary && (
                <p className="secondary-metrics">
                  {(heartRate.bpm !== null || hrConnected) && (
                    <span data-status={heartRate.status}>
                      {heartRate.bpm === null ? '—' : heartRate.bpm} bpm
                    </span>
                  )}
                  {(displayCadenceRpm !== null || cadenceConnected) && (
                    <span
                      data-status={
                        cadenceConnected ? cadence.status : snapshot.powerStatus
                      }
                      title={
                        displayCadenceSource === 'sensor'
                          ? 'Cadence sensor'
                          : 'Trainer cadence'
                      }
                    >
                      {displayCadenceRpm === null
                        ? '—'
                        : `${displayCadenceRpm.toFixed(0)} rpm`}
                    </span>
                  )}
                  {snapshot.speedKmh !== null && (
                    <span>{snapshot.speedKmh.toFixed(1)} km/h</span>
                  )}
                </p>
              )}
            </div>

            {(meterConnected ||
              meter.connectionState === 'disconnected-with-reconnect' ||
              meter.deviceName !== null) && (
              <div className="power-alignment" data-status={meter.powerStatus}>
                <p className="alignment-row">
                  <span className="alignment-label">Meter</span>
                  <span className="alignment-watts">
                    {meterPowerLabel(meter)}
                    <span className="power-unit">W</span>
                  </span>
                  <span className="alignment-delta" title="Meter − Trainer">
                    Δ {formatAlignmentDelta(alignmentDelta)}
                  </span>
                </p>
                <p className="alignment-hint muted">
                  Power Alignment · 5s avg · comparison only (trainer stays
                  primary)
                </p>
              </div>
            )}

            {inWorkout && (
              <div className="workout-live">
                {isFreeRide || runner.stepCount === 0 ? (
                  <>
                    <p className="workout-live-title">Free Ride</p>
                    <p className="workout-live-targets">
                      <span>
                        Elapsed{' '}
                        <strong>{formatClock(runner.elapsedSec)}</strong>
                      </span>
                    </p>
                  </>
                ) : (
                  <>
                    <p className="workout-live-title">
                      {runner.workoutName ?? 'Workout'} · step{' '}
                      {runner.stepIndex + 1}/{runner.stepCount}
                      {runner.stepType ? ` · ${runner.stepType}` : ''}
                    </p>
                    <p className="workout-live-targets">
                      <span>
                        Target{' '}
                        <strong>
                          {runner.stepTargetWatts === null
                            ? '—'
                            : `${runner.stepTargetWatts} W`}
                        </strong>
                      </span>
                      <span>
                        Left{' '}
                        <strong>{formatClock(runner.stepRemainingSec)}</strong>
                      </span>
                      <span>
                        Elapsed{' '}
                        <strong>{formatClock(runner.elapsedSec)}</strong>
                      </span>
                    </p>
                    {!snapshot.ergControlAvailable && (
                      <p className="muted">
                        Display-only targets — trainer ERG not available on this
                        connection.
                      </p>
                    )}
                  </>
                )}
                {(runner.status === 'completed' ||
                  runner.status === 'stopped') && (
                  <p className="muted">
                    {isFreeRide ? 'Free Ride' : 'Workout'} {runner.status}.
                    Activity saved when companion is up.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {riding && (
        <div className="actions ride-controls">
          {runner.status === 'running' && (
            <>
              <button type="button" onClick={onPause}>
                Pause
              </button>
              {!isFreeRide && runner.stepCount > 0 && (
                <button type="button" onClick={onSkip}>
                  Skip interval
                </button>
              )}
              <button type="button" className="danger" onClick={onStop}>
                Stop
              </button>
            </>
          )}
          {runner.status === 'paused' && (
            <>
              <button type="button" className="primary" onClick={onResume}>
                Resume
              </button>
              {!isFreeRide && runner.stepCount > 0 && (
                <button type="button" onClick={onSkip}>
                  Skip interval
                </button>
              )}
              <button type="button" className="danger" onClick={onStop}>
                Stop
              </button>
            </>
          )}
        </div>
      )}

      {!riding && (
        <section className="ride-plan panel-block" aria-label="Ride">
          <h2>Ride</h2>
          {todaysScheduled.length === 0 && !calendarSelection ? (
            <p className="muted">
              No rides scheduled for today — Start records a Free Ride, or pick
              one on Calendar.
            </p>
          ) : (
            <ul className="entity-list">
              {todaysScheduled.map((ride) => {
                const isSelected = selectedScheduledRideId === ride.id
                const outcome = scheduledOutcomeLabel(ride)
                const startable =
                  ride.status !== 'completed' && ride.status !== 'skipped'
                const workout = workouts.find((w) => w.id === ride.workoutId)
                const chart = chartFromScheduledWorkout(workout, ftpWatts)
                return (
                  <SessionModule
                    key={ride.id}
                    title={sessionTitle(workoutName(ride.workoutId), 'scheduled')}
                    meta={scheduledMeta(
                      ride.startsAt,
                      scheduledDurationLabel(workout, ftpWatts),
                      outcome,
                    )}
                    purpose={ride.purpose}
                    chartLabel={`${workoutName(ride.workoutId)} planned Power Profile`}
                    series={chart.series}
                    needsFtpToPreview={chart.needsFtpToPreview}
                    actions={
                      <button
                        type="button"
                        className={isSelected ? 'primary' : undefined}
                        disabled={selectingLocked || !startable}
                        onClick={() => toggleRide(ride)}
                      >
                        {!startable
                          ? outcome ?? 'Done'
                          : isSelected
                            ? 'Selected'
                            : 'Select'}
                      </button>
                    }
                  />
                )
              })}
              {calendarSelection && calendarChart && (
                <SessionModule
                  key={`cal-${calendarSelection.id}`}
                  title={sessionTitle(calendarSelection.name, 'scheduled')}
                  meta={scheduledMeta(
                    null,
                    scheduledDurationLabel(calendarSelection, ftpWatts),
                    null,
                    'From Calendar',
                  )}
                  chartLabel={`${calendarSelection.name} planned Power Profile`}
                  series={calendarChart.series}
                  needsFtpToPreview={calendarChart.needsFtpToPreview}
                  actions={
                    <button
                      type="button"
                      className="primary"
                      disabled={selectingLocked}
                      onClick={() => onSelectWorkout('', null, null)}
                    >
                      Selected
                    </button>
                  }
                />
              )}
            </ul>
          )}
          {selectedWorkoutId !== '' && (
            <button
              type="button"
              className="ride-plan-clear"
              disabled={selectingLocked}
              onClick={() => onSelectWorkout('', null, null)}
            >
              Clear · Free Ride instead
            </button>
          )}
          {needsFtp && (ftpWatts === null || ftpWatts <= 0) && (
            <p className="banner warn">
              This Workout uses %FTP or zones — set FTP via MCP (set_ftp)
              first.
            </p>
          )}
          <div className="actions ride-start">
            <button
              type="button"
              className="primary"
              disabled={!canStart}
              onClick={onStart}
            >
              {selectedWorkoutId ? 'Start workout' : 'Start Free Ride'}
            </button>
          </div>
          {!canStart && !connected && (
            <p className="muted ride-start-hint">
              <button
                type="button"
                className="linkish"
                onClick={onOpenDevices}
              >
                Connect trainer on Devices
              </button>{' '}
              to enable Start.
            </p>
          )}
        </section>
      )}
    </div>
  )
}
