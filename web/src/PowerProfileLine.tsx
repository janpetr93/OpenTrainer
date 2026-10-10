import type { ChartSeries } from './chart/metricSeries'
import {
  powerAxisMaxWatts,
  wattsToY,
  zoneBandRects,
} from './chart/zoneBands'
import type { PowerProfilePoint } from './api'

/** Backward-compatible series shape used by Workouts/Calendar panels. */
export type PowerProfileSeries = {
  points: PowerProfilePoint[]
  tone?: 'planned' | 'achieved'
}

type Props = {
  series: ChartSeries[] | PowerProfileSeries[]
  /** Accessible label */
  label: string
  className?: string
  /** Optional playhead at elapsed seconds */
  cursorSec?: number | null
  /** Fixed time axis (workout total); defaults to max of all series */
  maxTSec?: number
  height?: number
  width?: number
  /** When set, draw Coggan Power Zone bands on the shared watts axis. */
  ftpWatts?: number | null
}

const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 72
const PAD_X = 8
const PAD_Y = 10

function isChartSeries(s: ChartSeries | PowerProfileSeries): s is ChartSeries {
  return 'label' in s
}

function normalizeSeries(
  series: ChartSeries[] | PowerProfileSeries[],
): ChartSeries[] {
  return series.map((s, index) => {
    if (isChartSeries(s)) return s
    const tone = s.tone ?? (index === 0 ? 'planned' : 'achieved')
    return {
      tone,
      label: tone === 'planned' ? 'Plan' : 'Power',
      scale: 'watts' as const,
      points: s.points.map((p) => ({ tSec: p.tSec, value: p.watts })),
    }
  })
}

function toPoints(
  points: Array<{ tSec: number; value: number }>,
  maxT: number,
  maxV: number,
  width: number,
  height: number,
): string {
  return points
    .map((p) => {
      const x = PAD_X + (p.tSec / maxT) * (width - PAD_X * 2)
      const y = height - PAD_Y - (p.value / maxV) * (height - PAD_Y * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function strokeWidth(tone: ChartSeries['tone']): number {
  switch (tone) {
    case 'achieved':
      return 2.75
    case 'planned':
      return 2
    default:
      return 2.25
  }
}

/** SVG multi-metric profile; watts share a scale (optional zone bands). */
export function PowerProfileLine({
  series,
  label,
  className,
  cursorSec = null,
  maxTSec,
  height = DEFAULT_HEIGHT,
  width = DEFAULT_WIDTH,
  ftpWatts = null,
}: Props) {
  const normalized = normalizeSeries(series).filter((s) => s.points.length >= 2)
  if (normalized.length < 1) {
    return <p className="muted">No Power Profile yet</p>
  }

  const allPoints = normalized.flatMap((s) => s.points)
  const maxT = Math.max(maxTSec ?? 0, ...allPoints.map((p) => p.tSec), 1)
  const wattsSeries = normalized.filter((s) => s.scale === 'watts')
  const wattsDataMax = Math.max(
    1,
    ...wattsSeries.flatMap((s) => s.points.map((p) => p.value)),
  )
  const sharedWattsMax =
    ftpWatts !== null && ftpWatts > 0
      ? powerAxisMaxWatts({ ftpWatts, dataMaxWatts: wattsDataMax })
      : wattsDataMax
  const bands =
    ftpWatts !== null && ftpWatts > 0 && wattsSeries.length > 0
      ? zoneBandRects(ftpWatts, sharedWattsMax)
      : []

  const cursorX =
    cursorSec !== null && cursorSec !== undefined
      ? PAD_X + (Math.min(cursorSec, maxT) / maxT) * (width - PAD_X * 2)
      : null

  return (
    <svg
      className={className ?? 'power-profile-line'}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      {bands.map((band) => {
        const yTop = wattsToY(band.maxWatts, sharedWattsMax, height, PAD_Y)
        const yBot = wattsToY(band.minWatts, sharedWattsMax, height, PAD_Y)
        const bandHeight = Math.max(yBot - yTop, 0)
        const midY = yTop + bandHeight / 2
        return (
          <g key={`zone-${band.zone}`} className={`zone-band zone-band-z${band.zone}`}>
            <rect
              x={PAD_X}
              y={yTop}
              width={width - PAD_X * 2}
              height={bandHeight}
            />
            {bandHeight >= 14 && (
              <text
                className="zone-band-label"
                x={PAD_X + 6}
                y={midY}
                dominantBaseline="middle"
              >
                Z{band.zone}
              </text>
            )}
          </g>
        )
      })}
      {normalized.map((s) => {
        const maxV =
          s.scale === 'watts'
            ? sharedWattsMax
            : Math.max(...s.points.map((p) => p.value), 1)
        return (
          <polyline
            key={`${s.tone}-${s.label}`}
            className={`profile-series profile-series-${s.tone}`}
            fill="none"
            strokeWidth={strokeWidth(s.tone)}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={toPoints(s.points, maxT, maxV, width, height)}
          />
        )
      })}
      {cursorX !== null && (
        <line
          className="profile-cursor"
          x1={cursorX}
          x2={cursorX}
          y1={PAD_Y}
          y2={height - PAD_Y}
          strokeWidth="1.5"
        />
      )}
    </svg>
  )
}
