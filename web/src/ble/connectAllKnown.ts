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
  /**
   * Re-pair this role's Remembered Device.
   * Must call requestDevice before its first await. When omitted, the role is
   * only named in the summary.
   */
  repair?: () => Promise<void>
  /** This re-pair calls requestDevice, so it needs a user-gesture turn. */
  needsGesture?: boolean
  /** True when the browser refused another chooser from this click. */
  repairBlocked?: () => boolean
}

export type ConnectAllOptions = {
  /**
   * Run `start` inside a fresh user gesture. Used for every re-pair after the
   * click that started the run. `start` must call requestDevice synchronously.
   */
  renewGesture?: (start: () => Promise<void>) => Promise<void>
}

/** Button label: Re-pair all when every pending role needs a chooser. */
export function bulkConnectLabel(
  roles: Pick<
    ConnectAllRole,
    'connectionState' | 'knownDeviceCount' | 'rememberedName'
  >[],
): 'Re-pair all' | 'Connect all known' {
  let repair = false
  let known = false
  for (const role of roles) {
    if (role.connectionState === 'connected') continue
    if (role.knownDeviceCount > 0) known = true
    else if (role.rememberedName) repair = true
  }
  return repair && !known ? 'Re-pair all' : 'Connect all known'
}

/** Chrome's requestDevice error once the click may no longer open a chooser. */
export function repairBlockedByGesture(message: string | null): boolean {
  return message !== null && /user gesture/i.test(message)
}

/**
 * Connect every role that is not already connected.
 * Known Devices reconnect with no chooser. Remembered Devices are re-paired
 * first, from this same click, when `repair` is provided. A role with neither
 * is named in the summary (Find new…).
 * Returns a short Devices-tab summary string.
 */
export async function connectAllKnown(
  roles: ConnectAllRole[],
  options: ConnectAllOptions = {},
): Promise<string> {
  let connectedCount = 0
  let attempted = 0
  const needRepair: string[] = []
  const needFindNew: string[] = []
  const repairs: ConnectAllRole[] = []
  const known: ConnectAllRole[] = []

  for (const role of roles) {
    if (role.connectionState === 'connected') continue
    if (role.knownDeviceCount >= 1) {
      known.push(role)
      continue
    }
    if (role.rememberedName && role.repair) {
      repairs.push(role)
      continue
    }
    if (role.rememberedName) {
      needRepair.push(`${role.label} (${role.rememberedName})`)
    } else {
      needFindNew.push(role.label)
    }
  }

  let repairPaused = false
  let gestureFresh = true
  for (const role of repairs) {
    const named = `${role.label} (${role.rememberedName})`
    if (repairPaused) {
      needRepair.push(named)
      continue
    }
    attempted += 1
    const run = () => role.repair!()
    if (role.needsGesture && !gestureFresh && options.renewGesture) {
      await options.renewGesture(run)
    } else {
      await run()
    }
    gestureFresh = false
    if (role.getConnectionState() === 'connected') {
      connectedCount += 1
    } else {
      needRepair.push(named)
      if (role.repairBlocked?.()) repairPaused = true
    }
  }

  for (const role of known) {
    attempted += 1
    await role.connect()
    if (role.getConnectionState() === 'connected') {
      connectedCount += 1
    }
  }

  const parts = [
    needRepair.length === 0
      ? null
      : repairPaused
        ? `click Re-pair all again for ${formatList(needRepair)}`
        : `Re-pair ${formatList(needRepair)}`,
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
