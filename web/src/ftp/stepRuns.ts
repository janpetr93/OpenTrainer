export type DatedWatts = {
  date: string
  watts: number | null
}

export type StepVertex = {
  date: string
  watts: number
}

/**
 * Horizontal holds for one FTP Progression series.
 * A null watts value ends the run. The last non-null value holds out to `through`.
 */
export function stepRuns(
  points: DatedWatts[],
  through: string,
): StepVertex[][] {
  const runs: StepVertex[][] = []
  let run: StepVertex[] | null = null

  for (let i = 0; i < points.length; i++) {
    const point = points[i]!
    if (point.watts == null) {
      if (run) runs.push(run)
      run = null
      continue
    }

    const vertex = { date: point.date, watts: point.watts }
    if (!run) {
      run = [vertex]
    } else if (run[run.length - 1]!.watts !== point.watts) {
      run.push(vertex)
    }

    const next = points[i + 1]
    const endDate = next?.date ?? through
    if (endDate > point.date) {
      const end = { date: endDate, watts: point.watts }
      const last = run[run.length - 1]!
      if (last.date !== end.date || last.watts !== end.watts) run.push(end)
    }

    if (next == null || next.watts == null) {
      runs.push(run)
      run = null
    }
  }

  if (run) runs.push(run)
  return runs
}
