import type { PowerMeterSnapshot } from './cps'
import type { CadenceSnapshot } from './csc'
import type { TrainerSnapshot } from './ftms'
import type { HeartRateSnapshot } from './hrm'
import {
  ConnectorRole,
  type ConnectorRoleHandlers,
} from './ConnectorRole'

type Props = {
  snapshot: TrainerSnapshot
  meter: PowerMeterSnapshot
  heartRate: HeartRateSnapshot
  cadence: CadenceSnapshot
  connectAllSummary: string | null
  trainer: ConnectorRoleHandlers
  powerMeter: ConnectorRoleHandlers
  heartRateLink: ConnectorRoleHandlers
  cadenceLink: ConnectorRoleHandlers
  onConnectAllKnown: () => void
  onDisconnectAll: () => void
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

/** Devices tab — connectors, Known Devices, Connect All Known, FTMS debug. */
export function DevicesPanel({
  snapshot,
  meter,
  heartRate,
  cadence,
  connectAllSummary,
  trainer,
  powerMeter,
  heartRateLink,
  cadenceLink,
  onConnectAllKnown,
  onDisconnectAll,
}: Props) {
  const connected = snapshot.connectionState === 'connected'
  const meterConnected = meter.connectionState === 'connected'
  const hrConnected = heartRate.connectionState === 'connected'
  const cadenceConnected = cadence.connectionState === 'connected'

  return (
    <div className="devices-panel">
      <header className="live-header">
        <div className="brand-row">
          <h1>Devices</h1>
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

      <section className="connectors" aria-label="Connectors">
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
    </div>
  )
}
