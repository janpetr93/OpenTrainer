import type { KnownDevice } from './ble/knownDevice'

export type ConnectorRoleHandlers = {
  onConnect: () => void
  onConnectDevice: (deviceId: string) => void
  onChooser: () => void
  onScanAll: () => void
  onDisconnect: () => void
  onReconnect: () => void
}

type Props = {
  title: string
  connectionState: string
  deviceName: string | null
  knownDevices: KnownDevice[]
  connected: boolean
  canReconnect: boolean
  handlers: ConnectorRoleHandlers
}

export function ConnectorRole({
  title,
  connectionState,
  deviceName,
  knownDevices,
  connected,
  canReconnect,
  handlers,
}: Props) {
  const stateLabel = connectionState.replaceAll('-', ' ')

  return (
    <div className="connector-role" aria-label={`${title} connection`}>
      <div className="connector-role-header">
        <h3>{title}</h3>
        <p className="connection-state" data-state={connectionState}>
          {stateLabel}
          {deviceName ? ` · ${deviceName}` : ''}
        </p>
      </div>

      {knownDevices.length > 0 ? (
        <ul className="known-devices">
          {knownDevices.map((device) => (
            <li key={device.id}>
              <button
                type="button"
                className="known-device"
                disabled={connected}
                onClick={() => handlers.onConnectDevice(device.id)}
              >
                {device.name}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted known-devices-empty">
          No known devices yet — use Find new…
        </p>
      )}

      <div className="actions">
        {!connected && (
          <>
            <button type="button" onClick={handlers.onConnect}>
              Connect
            </button>
            {canReconnect && (
              <button type="button" onClick={handlers.onReconnect}>
                Reconnect
              </button>
            )}
            <details className="find-new">
              <summary>Find new…</summary>
              <div className="find-new-actions">
                <button type="button" onClick={handlers.onChooser}>
                  Chooser
                </button>
                <button type="button" onClick={handlers.onScanAll}>
                  Scan all
                </button>
              </div>
            </details>
          </>
        )}
        {connected && (
          <button type="button" onClick={handlers.onDisconnect}>
            Disconnect
          </button>
        )}
      </div>
    </div>
  )
}
