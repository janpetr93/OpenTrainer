/**
 * Present only in the macOS desktop app. Chrome and Windows keep using Web
 * Bluetooth for the cadence sensor.
 */
export type NativeCadenceLink = {
  connect(options?: { deviceId?: string; name?: string }): Promise<{ id: string; name: string | null }>
  disconnect(): Promise<void>
  onMeasurement(listener: (bytes: number[]) => void): () => void
  onDisconnected(listener: () => void): () => void
}

type DesktopWindow = Window & {
  openTrainer?: { cadence?: NativeCadenceLink }
}

export function nativeCadenceLink(): NativeCadenceLink | null {
  if (typeof window === 'undefined') return null
  return (window as DesktopWindow).openTrainer?.cadence ?? null
}

export function isCadenceBridgeUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('CADENCE_BRIDGE_UNAVAILABLE')
}
