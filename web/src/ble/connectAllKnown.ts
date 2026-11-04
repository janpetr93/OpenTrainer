import type { ConnectionState } from '../ftms/types'

export type ConnectAllRole = {
  label: string
  connectionState: ConnectionState
  knownDeviceCount: number
  /** Remembered device name; named in the summary when it needs Re-pair. */
  rememberedName?: string | null
  connect: () => Promise<void>
  /** Read Connection State after connect (GATT may fail without throwing). */
  getConnectionState: () => ConnectionState
}

/**
 * Sequentially connect roles that have Known Devices and are not connected.
 * Roles without one are named: Re-pair when a device is remembered (each
 * Device Picker needs its own click), Find new otherwise.
 * Returns a short Devices-tab summary string.
 */
export async function connectAllKnown(
  roles: ConnectAllRole[],
): Promise<string> {
  let connectedCount = 0
  let attempted = 0
  const needRepair: string[] = []
  const needFindNew: string[] = []

  for (const role of roles) {
    if (role.connectionState === 'connected') continue
    if (role.knownDeviceCount < 1) {
      if (role.rememberedName) {
        needRepair.push(`${role.label} (${role.rememberedName})`)
      } else {
        needFindNew.push(role.label)
      }
      continue
    }
    attempted += 1
    await role.connect()
    if (role.getConnectionState() === 'connected') {
      connectedCount += 1
    }
  }

  const parts = [
    needRepair.length === 0 ? null : `Re-pair ${formatList(needRepair)}`,
    needFindNew.length === 0 ? null : formatNeedFindNew(needFindNew),
  ].filter((p): p is string => p !== null)
  const needPart = parts.length === 0 ? null : parts.join('; ')

  if (connectedCount === 0 && attempted === 0 && needPart !== null) {
    return `No known devices to connect — ${needPart}`
  }

  if (needPart !== null) {
    return `Connected ${connectedCount} of ${roles.length} — ${needPart}`
  }

  return `Connected ${connectedCount} of ${roles.length}.`
}

function formatList(labels: string[]): string {
  if (labels.length === 1) return labels[0]
  const head = labels.slice(0, -1).join(', ')
  return `${head} / ${labels[labels.length - 1]}`
}

function formatNeedFindNew(labels: string[]): string {
  const verb = labels.length === 1 ? 'needs' : 'need'
  return `${formatList(labels)} ${verb} Find new…`
}
