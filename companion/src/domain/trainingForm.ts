import { isSportBlocker, localDateKey } from './blocker.js'
import type { BlockerKind, BlockerStatus } from './types.js'

/** Banister / Coggan PMC time constants (days). */
export const FITNESS_TIME_CONSTANT_DAYS = 42
export const FATIGUE_TIME_CONSTANT_DAYS = 7

/** Days of history required before Form is treated as reliable for coaching. */
export const FORM_RELIABLE_HISTORY_DAYS = 42

export type DailyTss = {
  /** Local calendar date YYYY-MM-DD. */
  date: string
  trainingStressScore: number
}

export type DailyTssActivityInput = {
  startedAt: string
  trainingStressScore: number | null
}

export type DailyTssBlockerInput = {
  kind: BlockerKind
  status: BlockerStatus
  startsAt: string
  trainingStressScore: number | null
}

/** Sum bike Session Load TSS + External Load on completed sport Blockers by local day. */
export function buildDailyTss(input: {
  activities: readonly DailyTssActivityInput[]
  blockers: readonly DailyTssBlockerInput[]
}): DailyTss[] {
  const byDate = new Map<string, number>()
  const add = (iso: string, tss: number) => {
    const date = localDateKey(iso)
    byDate.set(date, (byDate.get(date) ?? 0) + tss)
  }
  for (const activity of input.activities) {
    if (activity.trainingStressScore == null) continue
    if (!(activity.trainingStressScore > 0)) continue
    add(activity.startedAt, activity.trainingStressScore)
  }
  for (const blocker of input.blockers) {
    if (blocker.status !== 'completed') continue
    if (!isSportBlocker(blocker.kind)) continue
    if (blocker.trainingStressScore == null) continue
    if (!(blocker.trainingStressScore > 0)) continue
    add(blocker.startsAt, blocker.trainingStressScore)
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, trainingStressScore]) => ({
      date,
      trainingStressScore: round1(trainingStressScore),
    }))
}

export type TrainingFormDay = {
  date: string
  trainingStressScore: number
  fitness: number
  fatigue: number
  form: number
  ctl: number
  atl: number
  tsb: number
}

export type TrainingForm = {
  asOf: string
  fitness: number
  fatigue: number
  form: number
  ctl: number
  atl: number
  tsb: number
  historyDays: number
  reliable: boolean
  series: TrainingFormDay[]
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function parseDateKey(date: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) throw new Error(`date must be YYYY-MM-DD: ${date}`)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function formatDateKey(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function eachDateInclusive(from: string, to: string): string[] {
  const start = parseDateKey(from)
  const end = parseDateKey(to)
  if (start.getTime() > end.getTime()) {
    throw new Error(`asOf ${to} is before first daily TSS ${from}`)
  }
  const out: string[] = []
  const cur = new Date(start)
  while (cur.getTime() <= end.getTime()) {
    out.push(formatDateKey(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

/**
 * Banister EWMA: next = prev + (tss - prev) / tau.
 * Form = Fitness − Fatigue (TSB).
 * Pads missing days between the earliest daily TSS and asOf with 0 TSS.
 */
export function computeTrainingForm(
  dailyTss: readonly DailyTss[],
  asOf: string,
): TrainingForm {
  if (dailyTss.length === 0) {
    return {
      asOf,
      fitness: 0,
      fatigue: 0,
      form: 0,
      ctl: 0,
      atl: 0,
      tsb: 0,
      historyDays: 0,
      reliable: false,
      series: [],
    }
  }

  const byDate = new Map<string, number>()
  for (const day of dailyTss) {
    const prev = byDate.get(day.date) ?? 0
    byDate.set(day.date, prev + day.trainingStressScore)
  }
  const sortedDates = [...byDate.keys()].sort()
  const first = sortedDates[0]!
  const dates = eachDateInclusive(first, asOf)

  let fitness = 0
  let fatigue = 0
  const series: TrainingFormDay[] = []

  for (const date of dates) {
    const tss = byDate.get(date) ?? 0
    fitness = fitness + (tss - fitness) / FITNESS_TIME_CONSTANT_DAYS
    fatigue = fatigue + (tss - fatigue) / FATIGUE_TIME_CONSTANT_DAYS
    const fitnessOut = round1(fitness)
    const fatigueOut = round1(fatigue)
    const formOut = round1(fitness - fatigue)
    series.push({
      date,
      trainingStressScore: round1(tss),
      fitness: fitnessOut,
      fatigue: fatigueOut,
      form: formOut,
      ctl: fitnessOut,
      atl: fatigueOut,
      tsb: formOut,
    })
  }

  const last = series[series.length - 1]!
  const historyDays = series.length
  return {
    asOf,
    fitness: last.fitness,
    fatigue: last.fatigue,
    form: last.form,
    ctl: last.ctl,
    atl: last.atl,
    tsb: last.tsb,
    historyDays,
    reliable: historyDays >= FORM_RELIABLE_HISTORY_DAYS,
    series,
  }
}
