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
  /** primary = Trainer hero; compact = sensor row. */
  variant?: 'primary' | 'compact'
}

function FindNewMenu({
  handlers,
  compact,
}: {
  handlers: ConnectorRoleHandlers
  compact: boolean
}) {
  return (
    <details className={compact ? 'find-new find-new-compact' : 'find-new'}>
      <summary>{compact ? 'Find new' : 'Find new…'}</summary>
      <div className="find-new-actions">
        <button type="button" onClick={handlers.onChooser}>
          Chooser
        </button>
        <button type="button" onClick={handlers.onScanAll}>
          Scan all
        </button>
      </div>
    </details>
  )
}

export function ConnectorRole({
  title,
  connectionState,
  deviceName,
  knownDevices,
  connected,
  canReconnect,
  handlers,
  variant = 'primary',
}: Props) {
  const stateLabel = connectionState.replaceAll('-', ' ')
  const compact = variant === 'compact'

  if (compact) {
    return (
      <div
        className="connector-role connector-role-compact"
        aria-label={`${title} connection`}
      >
        <div className="connector-role-main">
          <h3>{title}</h3>
          <p className="connection-state" data-state={connectionState}>
            {stateLabel}
            {deviceName ? ` · ${deviceName}` : ''}
          </p>
        </div>
        <div className="connector-role-actions">
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
              {knownDevices.length > 0 ? (
                <details className="find-new find-new-compact">
                  <summary>Known</summary>
                  <ul className="known-devices known-devices-popover">
                    {knownDevices.map((device) => (
                      <li key={device.id}>
                        <button
                          type="button"
                          className="known-device"
                          onClick={() => handlers.onConnectDevice(device.id)}
                        >
                          {device.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <FindNewMenu handlers={handlers} compact />
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

  return (
    <div
      className="connector-role connector-role-primary"
      aria-label={`${title} connection`}
    >
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

      <div className="actions connector-role-actions">
        {!connected && (
          <>
            <button type="button" className="primary" onClick={handlers.onConnect}>
              Connect
            </button>
            {canReconnect && (
              <button type="button" onClick={handlers.onReconnect}>
                Reconnect
              </button>
            )}
            <FindNewMenu handlers={handlers} compact={false} />
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
