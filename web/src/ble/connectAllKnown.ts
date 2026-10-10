import type { ConnectionState } from '../ftms/types'

export type ConnectAllRole = {
  label: string
  connectionState: ConnectionState
  knownDeviceCount: number
  connect: () => Promise<void>
  /** Read Connection State after connect (GATT may fail without throwing). */
  getConnectionState: () => ConnectionState
}

/**
 * Sequentially connect roles that have Known Devices and are not connected.
 * Returns a short Ride-tab summary string.
 */
export async function connectAllKnown(
  roles: ConnectAllRole[],
): Promise<string> {
  let connectedCount = 0
  let attempted = 0
  const needFindNew: string[] = []

  for (const role of roles) {
    if (role.connectionState === 'connected') continue
    if (role.knownDeviceCount < 1) {
      needFindNew.push(role.label)
      continue
    }
    attempted += 1
    await role.connect()
    if (role.getConnectionState() === 'connected') {
      connectedCount += 1
    }
  }

  const needPart =
    needFindNew.length === 0 ? null : formatNeedFindNew(needFindNew)

  if (connectedCount === 0 && attempted === 0 && needPart !== null) {
    return `No known devices to connect — ${needPart}`
  }

  if (needPart !== null) {
    return `Connected ${connectedCount} of ${roles.length} — ${needPart}`
  }

  return `Connected ${connectedCount} of ${roles.length}.`
}

function formatNeedFindNew(labels: string[]): string {
  if (labels.length === 1) return `${labels[0]} needs Find new…`
  if (labels.length === 2) {
    return `${labels[0]} / ${labels[1]} need Find new…`
  }
  const head = labels.slice(0, -1).join(', ')
  return `${head} / ${labels[labels.length - 1]} need Find new…`
}
