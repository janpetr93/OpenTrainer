import { useState } from 'react'
import { PERSISTENT_PERMISSIONS_FLAG } from './ble/persistenceHint'

type Props = {
  onDismiss: () => void
}

/**
 * One-time Devices-tab hint: Chrome dropped this app's Bluetooth permissions
 * at restart; one flag makes them persist.
 */
export function BluetoothPersistenceHint({ onDismiss }: Props) {
  const [copied, setCopied] = useState(false)

  async function copyFlag(): Promise<void> {
    try {
      await navigator.clipboard.writeText(PERSISTENT_PERMISSIONS_FLAG)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div
      className="banner warn persistence-hint"
      role="note"
      aria-label="Keep paired devices after a restart"
    >
      <p>
        <strong>Chrome forgot your paired devices when it closed.</strong> By
        default Chrome keeps Bluetooth permissions for one browser session only,
        so the app cannot reconnect without the chooser.
      </p>
      <p>
        To make pairing stick: paste <code>{PERSISTENT_PERMISSIONS_FLAG}</code>{' '}
        into the address bar, set{' '}
        <em>Use the new permissions backend for Web Bluetooth</em> to{' '}
        <strong>Enabled</strong>, relaunch Chrome, then Re-pair each device
        once. After that, Connect all known reconnects them with one click.
        Until then, Re-pair opens the chooser with only your device in it.
      </p>
      <div className="persistence-hint-actions">
        <button type="button" onClick={() => void copyFlag()}>
          {copied ? 'Copied' : 'Copy flag address'}
        </button>
        <button type="button" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  )
}
