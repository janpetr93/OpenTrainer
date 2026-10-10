import type { PowerProfilePoint, ScheduledRide, Workout } from './api'
import {
  formatAlignmentDelta,
  type PowerMeterSnapshot,
} from './cps'
import type { CadenceSnapshot } from './csc'
import { workoutNeedsFtp } from './domain/resolveTarget'
import { buildRideChartSeries } from './chart/metricSeries'
import type { TrainerSnapshot } from './ftms'
import type { HeartRateSnapshot } from './hrm'
import {
  ConnectorRole,
  type ConnectorRoleHandlers,
} from './ConnectorRole'
import { PowerProfileLine } from './PowerProfileLine'
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
  runner: RunnerSnapshot
  plannedProfile: PowerProfilePoint[]
  achievedProfile: PowerProfilePoint[]
  saveMessage: string | null
  connectAllSummary: string | null
  ftpWatts: number | null
  onSelectWorkout: (id: string) => void
  trainer: ConnectorRoleHandlers
  powerMeter: ConnectorRoleHandlers
  heartRateLink: ConnectorRoleHandlers
  cadenceLink: ConnectorRoleHandlers
  onConnectAllKnown: () => void
  onDisconnectAll: () => void
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

function canReconnectSensor(link: {
  connectionState: string
  deviceName: string | null
}): boolean {
  return (
    link.connectionState === 'disconnected-with-reconnect' ||
    (link.connectionState === 'disconnected' && link.deviceName !== null)
  )
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
  runner,
  plannedProfile,
  achievedProfile,
  saveMessage,
  connectAllSummary,
  ftpWatts,
  onSelectWorkout,
  trainer,
  powerMeter,
  heartRateLink,
  cadenceLink,
  onConnectAllKnown,
  onDisconnectAll,
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
    (ride) => ride.workoutId === selectedWorkoutId,
  )
  const calendarSelection =
    selectedWorkoutId !== '' && !selectedFromToday ? selected : null

  function toggleWorkout(workoutId: string): void {
    onSelectWorkout(selectedWorkoutId === workoutId ? '' : workoutId)
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
  const showChart = rideSeries.length > 0
  /** Soft riding mode: setup collapses only while actively riding. */
  const riding =
    runner.status === 'running' || runner.status === 'paused'
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

  const connectorsBlock = (
    <>
      <div className="actions connectors-bulk">
        <button
          type="button"
          className="primary"
          onClick={onConnectAllKnown}
        >
          Connect all known
        </button>
        <button type="button" onClick={onDisconnectAll}>
          Disconnect all
        </button>
      </div>
      {connectAllSummary && (
        <p className="banner warn">{connectAllSummary}</p>
      )}
      <p className="muted connectors-hint">
        Known devices are ones Chrome already permitted for this app. After
        the first link, trainers often stop advertising — use Connect (not
        Find new) to reconnect.
      </p>
      <ConnectorRole
        title="Trainer"
        connectionState={snapshot.connectionState}
        deviceName={snapshot.deviceName}
        knownDevices={snapshot.knownDevices}
        connected={connected}
        canReconnect={canReconnectSensor(snapshot)}
        handlers={trainer}
      />
      <ConnectorRole
        title="Power meter"
        connectionState={meter.connectionState}
        deviceName={meter.deviceName}
        knownDevices={meter.knownDevices}
        connected={meterConnected}
        canReconnect={canReconnectSensor(meter)}
        handlers={powerMeter}
      />
      <ConnectorRole
        title="Heart rate"
        connectionState={heartRate.connectionState}
        deviceName={heartRate.deviceName}
        knownDevices={heartRate.knownDevices}
        connected={hrConnected}
        canReconnect={canReconnectSensor(heartRate)}
        handlers={heartRateLink}
      />
      <ConnectorRole
        title="Cadence"
        connectionState={cadence.connectionState}
        deviceName={cadence.deviceName}
        knownDevices={cadence.knownDevices}
        connected={cadenceConnected}
        canReconnect={canReconnectSensor(cadence)}
        handlers={cadenceLink}
      />
    </>
  )

  return (
    <div className={`live-display${riding ? ' live-display-riding' : ''}`}>
      <header className="live-header">
        <div className="brand-row">
          <h1>OpenTrainer</h1>
          <SensorStatusStrip sensors={sensors} ftpWatts={ftpWatts} />
        </div>
      </header>

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
            <PowerProfileLine
              className="power-profile-line ride-power-chart"
              label="Live metrics versus time with power zones"
              height={260}
              width={960}
              ftpWatts={ftpWatts}
              maxTSec={
                plannedProfile.length
                  ? Math.max(...plannedProfile.map((p) => p.tSec))
                  : undefined
              }
              cursorSec={
                riding || inWorkout ? runner.elapsedSec : null
              }
              series={rideSeries}
            />
            <p className="chart-legend muted">
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
            {showChart && (ftpWatts === null || ftpWatts <= 0) && (
              <p className="alignment-hint muted">
                Set FTP on the Profile tab to show Power Zone bands.
              </p>
            )}
          </div>
        )}

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
              Power Alignment · 5s avg · comparison only (trainer stays primary)
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
                    Elapsed <strong>{formatClock(runner.elapsedSec)}</strong>
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
                    Left <strong>{formatClock(runner.stepRemainingSec)}</strong>
                  </span>
                  <span>
                    Elapsed <strong>{formatClock(runner.elapsedSec)}</strong>
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
            {(runner.status === 'completed' || runner.status === 'stopped') && (
              <p className="muted">
                {isFreeRide ? 'Free Ride' : 'Workout'} {runner.status}. Activity
                saved when companion is up.
              </p>
            )}
          </div>
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

      {riding && (
        <details className="connectors-strip panel-block">
          <summary className="connectors-strip-summary">
            <span>Sensors</span>
            <SensorStatusStrip sensors={sensors} />
          </summary>
          <div className="connectors connectors-expanded" aria-label="Connectors">
            {connectorsBlock}
          </div>
        </details>
      )}

      {!riding && (
        <>
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
                  const isSelected = selectedWorkoutId === ride.workoutId
                  return (
                    <li key={ride.id} className="cal-item ride-plan-row">
                      <div>
                        <strong>{workoutName(ride.workoutId)}</strong>
                        <span className="muted">
                          {new Date(ride.startsAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="cal-item-actions">
                        <button
                          type="button"
                          className={isSelected ? 'primary' : undefined}
                          disabled={selectingLocked}
                          onClick={() => toggleWorkout(ride.workoutId)}
                        >
                          {isSelected ? 'Selected' : 'Select'}
                        </button>
                      </div>
                    </li>
                  )
                })}
                {calendarSelection && (
                  <li className="cal-item ride-plan-row">
                    <div>
                      <strong>{calendarSelection.name}</strong>
                      <span className="muted">From Calendar</span>
                    </div>
                    <div className="cal-item-actions">
                      <button
                        type="button"
                        className="primary"
                        disabled={selectingLocked}
                        onClick={() => onSelectWorkout('')}
                      >
                        Selected
                      </button>
                    </div>
                  </li>
                )}
              </ul>
            )}
            {selectedWorkoutId !== '' && (
              <button
                type="button"
                className="ride-plan-clear"
                disabled={selectingLocked}
                onClick={() => onSelectWorkout('')}
              >
                Clear · Free Ride instead
              </button>
            )}
            {needsFtp && (ftpWatts === null || ftpWatts <= 0) && (
              <p className="banner warn">
                This Workout uses %FTP or zones — set FTP on the Profile tab
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
                Connect a trainer below to enable Start.
              </p>
            )}
          </section>

          <section className="connectors" aria-label="Connectors">
            {connectorsBlock}
          </section>

          <details className="debug-panel">
            <summary>FTMS debug</summary>
            <div className="debug-body">
              <h3>Features</h3>
              {snapshot.features ? (
                <ul>
                  <li>
                    Target power supported:{' '}
                    {snapshot.features.targetPowerSupported ? 'yes' : 'no'}
                  </li>
                  <li>
                    ERG control available:{' '}
                    {snapshot.ergControlAvailable ? 'yes' : 'no'}
                  </li>
                  <li>Raw: {snapshot.features.rawHex}</li>
                </ul>
              ) : (
                <p>No feature data yet.</p>
              )}

              <h3>Control Probe</h3>
              {snapshot.controlProbeLog.length === 0 ? (
                <p>No probe log yet.</p>
              ) : (
                <ol>
                  {snapshot.controlProbeLog.map((line, index) => (
                    <li key={`${index}-${line}`}>{line}</li>
                  ))}
                </ol>
              )}

              <h3>Services</h3>
              <ul>
                {snapshot.services.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>

              <h3>Characteristics</h3>
              <ul>
                {snapshot.characteristics.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>

              <h3>Last Indoor Bike raw fields</h3>
              {snapshot.lastIndoorBikeRaw ? (
                <pre>{JSON.stringify(snapshot.lastIndoorBikeRaw, null, 2)}</pre>
              ) : (
                <p>None yet.</p>
              )}
            </div>
          </details>
        </>
      )}
    </div>
  )
}
