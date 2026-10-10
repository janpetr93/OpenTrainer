import type { MmpPointView } from '../api'

type Props = {
  points: MmpPointView[]
  setFtpWatts: number | null
  label?: string
  width?: number
  height?: number
}

const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 120
const PAD_L = 36
const PAD_R = 12
const PAD_T = 10
const PAD_B = 28

/** Small log-x chart of Mean Maximal Power points (not a session Power Profile). */
export function MmpChart({
  points,
  setFtpWatts,
  label = 'Mean Maximal Power',
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: Props) {
  const plotted = points.filter((p) => p.watts !== null)
  if (plotted.length === 0) {
    return (
      <p className="muted mmp-chart-empty" role="img" aria-label={label}>
        No MMP points yet.
      </p>
    )
  }

  const minLog = Math.log10(plotted[0]!.durationSec)
  const maxLog = Math.log10(plotted[plotted.length - 1]!.durationSec)
  const maxWatts = Math.max(
    ...plotted.map((p) => p.watts!),
    setFtpWatts ?? 0,
    1,
  )
  const plotW = width - PAD_L - PAD_R
  const plotH = height - PAD_T - PAD_B

  const xOf = (durationSec: number) => {
    const t =
      maxLog === minLog
        ? 0.5
        : (Math.log10(durationSec) - minLog) / (maxLog - minLog)
    return PAD_L + t * plotW
  }
  const yOf = (watts: number) => PAD_T + (1 - watts / maxWatts) * plotH

  const path = plotted
    .map((p, i) => {
      const x = xOf(p.durationSec)
      const y = yOf(p.watts!)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      className="mmp-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
    >
      {setFtpWatts !== null && setFtpWatts > 0 && (
        <g className="mmp-ftp-line">
          <line
            x1={PAD_L}
            x2={width - PAD_R}
            y1={yOf(setFtpWatts)}
            y2={yOf(setFtpWatts)}
          />
          <text x={PAD_L + 4} y={yOf(setFtpWatts) - 4}>
            FTP {setFtpWatts}
          </text>
        </g>
      )}
      <path className="mmp-curve" d={path} fill="none" />
      {plotted.map((p) => (
        <circle
          key={p.durationSec}
          className="mmp-point"
          cx={xOf(p.durationSec)}
          cy={yOf(p.watts!)}
          r={3.5}
        />
      ))}
    </svg>
  )
}
