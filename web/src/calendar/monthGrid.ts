/** Local calendar-day key YYYY-MM-DD */
export function dayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function startOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1)
}

export function endOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex + 1, 0, 23, 59, 59, 999)
}

/** Monday-first grid cells for a month (null = padding). */
export function monthCells(year: number, monthIndex: number): Array<Date | null> {
  const first = startOfMonth(year, monthIndex)
  const daysInMonth = endOfMonth(year, monthIndex).getDate()
  // JS: 0=Sun … convert to Mon=0
  const startPad = (first.getDay() + 6) % 7
  const cells: Array<Date | null> = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, monthIndex, day))
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export function monthRangeIso(year: number, monthIndex: number): {
  since: string
  until: string
} {
  return {
    since: startOfMonth(year, monthIndex).toISOString(),
    until: endOfMonth(year, monthIndex).toISOString(),
  }
}

/** Local calendar-day bounds as ISO strings for scheduled-ride queries. */
export function dayRangeIso(date: Date): { since: string; until: string } {
  const y = date.getFullYear()
  const m = date.getMonth()
  const d = date.getDate()
  return {
    since: new Date(y, m, d, 0, 0, 0, 0).toISOString(),
    until: new Date(y, m, d, 23, 59, 59, 999).toISOString(),
  }
}
