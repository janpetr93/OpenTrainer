import {
  formatAxisTime,
  formatAxisWatts,
  threeAxisTicks,
  wattsAxisDomain,
} from './chart/axisTicks'
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
  /**
   * Session charts: HTML watts/time ticks around the plot plus faint gridlines.
   * Keeps tick text crisp while the plot still stretches to fill.
   */
  showAxes?: boolean
}

const DEFAULT_WIDTH = 640
const DEFAULT_HEIGHT = 72
const PAD_X = 8
const PAD_Y = 10

type PlotPad = {
  left: number
  right: number
  top: number
  bottom: number
}

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

function xOf(tSec: number, maxT: number, width: number, pad: PlotPad): number {
  const plotW = width - pad.left - pad.right
  return pad.left + (tSec / maxT) * plotW
}

function yOf(
  value: number,
  minV: number,
  maxV: number,
  height: number,
  pad: PlotPad,
): number {
  const plotH = height - pad.top - pad.bottom
  const span = Math.max(maxV - minV, 1)
  const clamped = Math.min(Math.max(value, minV), maxV)
  return height - pad.bottom - ((clamped - minV) / span) * plotH
}

function toPoints(
  points: Array<{ tSec: number; value: number }>,
  maxT: number,
  minV: number,
  maxV: number,
  width: number,
  height: number,
  pad: PlotPad,
): string {
  return points
    .map((p) => {
      const x = xOf(p.tSec, maxT, width, pad)
      const y = yOf(p.value, minV, maxV, height, pad)
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
  showAxes = false,
}: Props) {
  const normalized = normalizeSeries(series).filter((s) => s.points.length >= 2)
  if (normalized.length < 1) {
    return <p className="muted">No Power Profile yet</p>
  }

  const pad: PlotPad = { left: PAD_X, right: PAD_X, top: PAD_Y, bottom: PAD_Y }

  const allPoints = normalized.flatMap((s) => s.points)
  const maxT = Math.max(maxTSec ?? 0, ...allPoints.map((p) => p.tSec), 1)
  const wattsSeries = normalized.filter((s) => s.scale === 'watts')
  const wattsValues = wattsSeries.flatMap((s) => s.points.map((p) => p.value))
  const wattsDataMax = Math.max(1, ...wattsValues)
  const wattsDataMin = wattsValues.length > 0 ? Math.min(...wattsValues) : 0

  // Session charts: zoom Y to data ± margin. Live ride keeps 0-based (zones).
  const wattsDomain = showAxes
    ? wattsAxisDomain(wattsDataMin, wattsDataMax)
    : {
        min: 0,
        max:
          ftpWatts !== null && ftpWatts > 0
            ? powerAxisMaxWatts({ ftpWatts, dataMaxWatts: wattsDataMax })
            : wattsDataMax,
      }
  const wattsMin = wattsDomain.min
  const wattsMax = wattsDomain.max

  const bands =
    !showAxes && ftpWatts !== null && ftpWatts > 0 && wattsSeries.length > 0
      ? zoneBandRects(ftpWatts, wattsMax)
      : []

  const cursorX =
    cursorSec !== null && cursorSec !== undefined
      ? xOf(Math.min(cursorSec, maxT), maxT, width, pad)
      : null

  const yTicks = showAxes ? [...new Set(threeAxisTicks(wattsMin, wattsMax))] : []
  const xTicks = showAxes ? [...new Set(threeAxisTicks(0, maxT))] : []
  // Top → bottom for a column flex that matches the plot (high watts at top).
  const yTickLabels = [...yTicks].sort((a, b) => b - a)
  const plotLeft = pad.left
  const plotWidth = width - pad.left - pad.right

  const svg = (
    <svg
      className={showAxes ? 'power-profile-line session-power-chart-plot' : (className ?? 'power-profile-line')}
      viewBox={`0 0 ${width} ${height}`}
      role={showAxes ? 'presentation' : 'img'}
      aria-label={showAxes ? undefined : label}
      aria-hidden={showAxes || undefined}
      preserveAspectRatio="none"
    >
      {bands.map((band) => {
        const yTop = wattsToY(
          band.maxWatts,
          wattsMax,
          height,
          pad.top,
          pad.bottom,
        )
        const yBot = wattsToY(
          band.minWatts,
          wattsMax,
          height,
          pad.top,
          pad.bottom,
        )
        const bandHeight = Math.max(yBot - yTop, 0)
        const midY = yTop + bandHeight / 2
        return (
          <g key={`zone-${band.zone}`} className={`zone-band zone-band-z${band.zone}`}>
            <rect
              x={plotLeft}
              y={yTop}
              width={plotWidth}
              height={bandHeight}
            />
            {bandHeight >= 14 && (
              <text
                className="zone-band-label"
                x={plotLeft + 6}
                y={midY}
                dominantBaseline="middle"
              >
                Z{band.zone}
              </text>
            )}
          </g>
        )
      })}
      {yTicks.map((watts) => {
        const y = yOf(watts, wattsMin, wattsMax, height, pad)
        return (
          <line
            key={`grid-y-${watts}`}
            className="axis-grid"
            x1={plotLeft}
            x2={plotLeft + plotWidth}
            y1={y}
            y2={y}
            vectorEffect="nonScalingStroke"
          />
        )
      })}
      {normalized.map((s) => {
        const minV = s.scale === 'watts' ? wattsMin : 0
        const maxV =
          s.scale === 'watts'
            ? wattsMax
            : Math.max(...s.points.map((p) => p.value), 1)
        return (
          <polyline
            key={`${s.tone}-${s.label}`}
            className={`profile-series profile-series-${s.tone}`}
            fill="none"
            strokeWidth={strokeWidth(s.tone)}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="nonScalingStroke"
            points={toPoints(s.points, maxT, minV, maxV, width, height, pad)}
          />
        )
      })}
      {cursorX !== null && (
        <line
          className="profile-cursor"
          x1={cursorX}
          x2={cursorX}
          y1={pad.top}
          y2={height - pad.bottom}
          strokeWidth="1.5"
          vectorEffect="nonScalingStroke"
        />
      )}
    </svg>
  )

  if (!showAxes) return svg

  return (
    <div
      className={`session-chart-axes ${className ?? ''}`.trim()}
      role="img"
      aria-label={label}
    >
      <div className="session-chart-y" aria-hidden="true">
        {yTickLabels.map((watts) => (
          <span key={`y-${watts}`}>{formatAxisWatts(watts)}</span>
        ))}
      </div>
      {svg}
      <div className="session-chart-x" aria-hidden="true">
        {xTicks.map((tSec) => (
          <span key={`x-${tSec}`}>{formatAxisTime(tSec)}</span>
        ))}
      </div>
    </div>
  )
}
