import type { Blocker, BlockerKind, CreateBlockerInput } from './types.js'

export const BLOCKER_KINDS = ['social', 'run', 'gym', 'swim'] as const

export const BLOCKER_LABEL_MAX_LEN = 80

const KIND_TITLE: Record<BlockerKind, string> = {
  social: 'Social',
  run: 'Run',
  gym: 'Gym',
  swim: 'Swim',
}

export function isBlockerKind(value: unknown): value is BlockerKind {
  return (
    typeof value === 'string' &&
    (BLOCKER_KINDS as readonly string[]).includes(value)
  )
}

export function isSportBlocker(kind: BlockerKind): boolean {
  return kind === 'run' || kind === 'gym' || kind === 'swim'
}

export function blockerTitle(blocker: {
  kind: BlockerKind
  label: string | null
}): string {
  const label = blocker.label?.trim()
  return label ? label : KIND_TITLE[blocker.kind]
}

export function normalizeBlockerLabel(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > BLOCKER_LABEL_MAX_LEN) {
    throw new Error(
      `label must be at most ${BLOCKER_LABEL_MAX_LEN} characters`,
    )
  }
  return trimmed
}

export type TimeWindow = { startMs: number; endMs: number }

export function blockerWindow(blocker: {
  startsAt: string
  allDay: boolean
  durationMin: number | null
}): TimeWindow {
  const start = new Date(blocker.startsAt)
  if (Number.isNaN(start.getTime())) {
    throw new Error('startsAt must be a valid ISO datetime')
  }
  if (blocker.allDay) {
    const dayStart = new Date(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
    )
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)
    return { startMs: dayStart.getTime(), endMs: dayEnd.getTime() }
  }
  if (
    blocker.durationMin === null ||
    !Number.isInteger(blocker.durationMin) ||
    blocker.durationMin <= 0
  ) {
    throw new Error('durationMin must be a positive integer')
  }
  return {
    startMs: start.getTime(),
    endMs: start.getTime() + blocker.durationMin * 60_000,
  }
}

export function windowsOverlap(a: TimeWindow, b: TimeWindow): boolean {
  return a.startMs < b.endMs && b.startMs < a.endMs
}

/** Local calendar day that contains iso, [midnight, next midnight). */
export function localDayWindow(iso: string): TimeWindow {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    throw new Error('startsAt must be a valid ISO datetime')
  }
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)
  return { startMs: dayStart.getTime(), endMs: dayEnd.getTime() }
}

export function localDateKey(iso: string): string {
  const d = new Date(iso)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/** Next local calendar date, for an all-day Google event end (exclusive). */
export function nextLocalDateKey(iso: string): string {
  const d = new Date(iso)
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  const month = String(next.getMonth() + 1).padStart(2, '0')
  const day = String(next.getDate()).padStart(2, '0')
  return `${next.getFullYear()}-${month}-${day}`
}

export function blockerFromInput(
  input: CreateBlockerInput,
  id: string,
  createdAt: string,
  schemaVersion: Blocker['schemaVersion'],
): Blocker {
  if (!isBlockerKind(input.kind)) {
    throw new Error('kind must be social, run, gym, or swim')
  }
  const startsAtMs = Date.parse(input.startsAt)
  if (Number.isNaN(startsAtMs)) {
    throw new Error('startsAt must be a valid ISO datetime')
  }
  const allDay = input.allDay === true
  const durationMin = allDay ? null : (input.durationMin ?? null)
  const blocker: Blocker = {
    schemaVersion,
    id,
    kind: input.kind,
    startsAt: new Date(startsAtMs).toISOString(),
    allDay,
    durationMin,
    label: normalizeBlockerLabel(input.label),
    createdAt,
  }
  blockerWindow(blocker)
  return blocker
}
