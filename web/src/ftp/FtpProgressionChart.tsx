import type { FtpProgression } from '../api'
import { stepRuns, type StepVertex } from './stepRuns'

type Props = {
  progression: FtpProgression
  width?: number
  height?: number
}

const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 168
const PAD_L = 40
const PAD_R = 12
const PAD_T = 12
const PAD_B = 28

function dateMs(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1).getTime()
}

function formatDay(isoDate: string): string {
  return new Date(dateMs(isoDate)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function latestWatts(
  points: FtpProgression['points'],
  key: 'setFtpWatts' | 'estimatedFtpWatts',
): number | null {
  let watts: number | null = null
  for (const point of points) watts = point[key]
  return watts
}

function polyline(vertices: StepVertex[], xOf: (date: string) => number, yOf: (watts: number) => number): string {
  return vertices
    .map((vertex, index) => {
      const command = index === 0 ? 'M' : 'L'
      return `${command} ${xOf(vertex.date).toFixed(1)} ${yOf(vertex.watts).toFixed(1)}`
    })
    .join(' ')
}

/** Date chart of set FTP and Estimated FTP. Holds are flat; a clear breaks the line. */
export function FtpProgressionChart({
  progression,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: Props) {
  const setRuns = stepRuns(
    progression.points.map((point) => ({
      date: point.date,
      watts: point.setFtpWatts,
    })),
    progression.through,
  )
  const estimatedRuns = stepRuns(
    progression.points.map((point) => ({
      date: point.date,
      watts: point.estimatedFtpWatts,
    })),
    progression.through,
  )
  const vertices = [...setRuns.flat(), ...estimatedRuns.flat()]
  if (vertices.length === 0) {
    return <p className="muted">No set FTP or 20-minute best yet.</p>
  }

  const dates = vertices.map((vertex) => vertex.date)
  dates.push(progression.through)
  const minMs = Math.min(...dates.map(dateMs))
  const maxMs = Math.max(...dates.map(dateMs))
  const maxWatts = Math.max(...vertices.map((vertex) => vertex.watts), 1)
  const plotW = width - PAD_L - PAD_R
  const plotH = height - PAD_T - PAD_B
  const xOf = (date: string) => {
    if (maxMs === minMs) return PAD_L + plotW / 2
    const t = (dateMs(date) - minMs) / (maxMs - minMs)
    return PAD_L + t * plotW
  }
  const yOf = (watts: number) => PAD_T + (1 - watts / maxWatts) * plotH

  const setNow = latestWatts(progression.points, 'setFtpWatts')
  const estimatedNow = latestWatts(progression.points, 'estimatedFtpWatts')
  const label = [
    'FTP Progression',
    setNow != null ? `Set FTP ${setNow} W` : 'Set FTP unset',
    estimatedNow != null
      ? `Estimated FTP ${estimatedNow} W`
      : 'Estimated FTP unavailable',
    `through ${formatDay(progression.through)}`,
  ].join('. ')

  const yTicks = [...new Set([0, Math.round(maxWatts / 2), maxWatts])]
  const startDate = dates.reduce((earliest, date) =>
    date < earliest ? date : earliest,
  )

  return (
    <figure className="ftp-progression">
      <svg
        className="ftp-progression-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
      >
        {yTicks.map((tick) => (
          <text key={tick} x={PAD_L - 6} y={yOf(tick) + 3} textAnchor="end">
            {tick}
          </text>
        ))}
        <text x={xOf(startDate)} y={height - 8} textAnchor="start">
          {formatDay(startDate)}
        </text>
        {progression.through !== startDate && (
          <text x={xOf(progression.through)} y={height - 8} textAnchor="end">
            {formatDay(progression.through)}
          </text>
        )}
        {setRuns.map((run, index) =>
          run.length === 1 ? (
            <circle
              key={`set-${index}`}
              className="ftp-progression-set ftp-progression-point"
              cx={xOf(run[0]!.date)}
              cy={yOf(run[0]!.watts)}
              r={3.5}
            />
          ) : (
            <path
              key={`set-${index}`}
              className="ftp-progression-set"
              d={polyline(run, xOf, yOf)}
              fill="none"
            />
          ),
        )}
        {estimatedRuns.map((run, index) =>
          run.length === 1 ? (
            <circle
              key={`est-${index}`}
              className="ftp-progression-estimated ftp-progression-point"
              cx={xOf(run[0]!.date)}
              cy={yOf(run[0]!.watts)}
              r={3.5}
            />
          ) : (
            <path
              key={`est-${index}`}
              className="ftp-progression-estimated"
              d={polyline(run, xOf, yOf)}
              fill="none"
            />
          ),
        )}
      </svg>
      <figcaption className="ftp-progression-legend">
        <span>
          <span className="ftp-progression-swatch ftp-progression-swatch-set" />
          Set FTP
          {setNow != null ? ` ${setNow} W` : ''}
        </span>
        <span>
          <span className="ftp-progression-swatch ftp-progression-swatch-estimated" />
          Estimated FTP
          {estimatedNow != null ? ` ${estimatedNow} W` : ''}
        </span>
      </figcaption>
    </figure>
  )
}
