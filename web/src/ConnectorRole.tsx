import { connectActionFor } from './ble/connectAction'
import type { KnownDevice } from './ble/knownDevice'
import type { RememberedDevice } from './ble/rememberedDevices'

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
  /** Lower-case role name for copy, e.g. "trainer", "heart rate monitor". */
  roleNoun: string
  connectionState: string
  deviceName: string | null
  knownDevices: KnownDevice[]
  /** Last device used in this role, remembered across browser restarts. */
  rememberedDevice: RememberedDevice | null
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

function YourDevice({
  roleNoun,
  rememberedDevice,
}: {
  roleNoun: string
  rememberedDevice: RememberedDevice | null
}) {
  if (!rememberedDevice?.name) return null
  return (
    <p className="your-device">
      Your {roleNoun}: <strong>{rememberedDevice.name}</strong>
    </p>
  )
}

export function ConnectorRole({
  title,
  roleNoun,
  connectionState,
  deviceName,
  knownDevices,
  rememberedDevice,
  connected,
  canReconnect,
  handlers,
  variant = 'primary',
}: Props) {
  const stateLabel = connectionState.replaceAll('-', ' ')
  const compact = variant === 'compact'
  const action = connectActionFor({
    knownDevices,
    remembered: rememberedDevice,
  })

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
          {!connected && (
            <YourDevice
              roleNoun={roleNoun}
              rememberedDevice={rememberedDevice}
            />
          )}
        </div>
        <div className="connector-role-actions">
          {!connected && (
            <>
              <button type="button" onClick={handlers.onConnect}>
                {action.kind === 'repair' ? 'Re-pair' : 'Connect'}
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
        {!connected && (
          <YourDevice
            roleNoun={roleNoun}
            rememberedDevice={rememberedDevice}
          />
        )}
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
      ) : action.kind === 'repair' ? (
        <p className="muted known-devices-empty">
          Not a known device since the last restart. Re-pair opens the chooser
          with only {rememberedDevice?.name} in it.
        </p>
      ) : (
        <p className="muted known-devices-empty">
          No known devices yet — use Find new…
        </p>
      )}

      <div className="actions connector-role-actions">
        {!connected && (
          <>
            <button
              type="button"
              className="primary"
              onClick={handlers.onConnect}
            >
              {action.label}
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
