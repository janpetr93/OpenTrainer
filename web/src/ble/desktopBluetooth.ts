/**
 * Desktop-app hook for Re-pair all. Chrome never has this; each chooser there
 * still depends on the original click.
 *
 * `requestDevice` checks the user gesture at the call, and in Electron that
 * does not survive an await. Arm with sendSync, then call requestDevice in
 * the same turn. Later devices get a synthetic click whose handler does both.
 */
export type DesktopBluetooth = {
  armRepair(name: string): void
  finishRepair(): Promise<void>
  /** Click a point in the page so the next requestDevice runs in that event. */
  click(x: number, y: number): Promise<void>
}

type DesktopWindow = Window & {
  openTrainer?: { bluetooth?: DesktopBluetooth }
}

const GESTURE_CLICK = { x: 4, y: 4 }

/** Tell the desktop shell which name to pick. No-op in Chrome. Synchronous. */
export function armRepair(name: string): void {
  try {
    readDesktopBluetooth()?.armRepair(name)
  } catch {
    // An older shell has no sync channel. The chooser still opens.
  }
}

export async function finishRepair(): Promise<void> {
  await readDesktopBluetooth()?.finishRepair()
}

/**
 * Call `start` from a new click. `start` must call requestDevice before it
 * awaits. In Chrome there is no shell, so `start` runs in the current turn.
 */
export function performInGesture(
  start: () => Promise<void>,
  desktop: DesktopBluetooth | null = readDesktopBluetooth(),
): Promise<void> {
  if (!desktop || typeof document === 'undefined') return start()
  const button = gestureButton()
  return new Promise((resolve) => {
    let settled = false
    let timer = 0
    const finish = (pending: Promise<void>) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      button.removeEventListener('click', onClick)
      resolve(pending)
    }
    const onClick = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      finish(start())
    }
    timer = window.setTimeout(() => finish(start()), 1000)
    button.addEventListener('click', onClick)
    const rect = button.getBoundingClientRect()
    void desktop
      .click(
        Math.round(rect.left + rect.width / 2) || GESTURE_CLICK.x,
        Math.round(rect.top + rect.height / 2) || GESTURE_CLICK.y,
      )
      .catch(() => finish(start()))
  })
}

/**
 * Re-pair wrapper. Arms the shell, then calls `open` before any await so
 * requestDevice still sees the click (or the synthetic one).
 */
export function rememberedRepair(
  name: string,
  open: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    armRepair(name)
    try {
      await open()
    } finally {
      await finishRepair()
    }
  }
}

function gestureButton(): HTMLButtonElement {
  const existing = document.getElementById('repair-gesture')
  if (existing instanceof HTMLButtonElement) return existing
  const button = document.createElement('button')
  button.id = 'repair-gesture'
  button.type = 'button'
  button.tabIndex = -1
  button.setAttribute('aria-hidden', 'true')
  button.style.position = 'fixed'
  button.style.left = '0'
  button.style.top = '0'
  button.style.width = '8px'
  button.style.height = '8px'
  button.style.opacity = '0'
  button.style.zIndex = '2147483647'
  button.style.padding = '0'
  button.style.border = '0'
  document.body.appendChild(button)
  return button
}

function readDesktopBluetooth(): DesktopBluetooth | null {
  if (typeof window === 'undefined') return null
  return (window as DesktopWindow).openTrainer?.bluetooth ?? null
}
