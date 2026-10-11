import {
  formatAxisBpm,
  formatAxisRpm,
  formatAxisTime,
  formatAxisWatts,
  niceAxisTicks,
  threeAxisTicks,
  wattsAxisDomain,
} from './chart/axisTicks'
import {
  bodyChartAxisSides,
  chartScaleDomain,
  type ChartPoint,
  type ChartScale,
  type ChartSeries,
} from './chart/metricSeries'
import { smoothChartPoints } from './chart/smoothSeries'
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
   * HTML Y/time ticks around the plot plus faint gridlines.
   * Keeps tick text crisp while the plot still stretches to fill.
   */
  showAxes?: boolean
  /** Omit the time tick row (e.g. upper chart in a stacked ride pair). */
  hideXAxis?: boolean
  /**
   * Session charts: zoom the watts Y domain to data ± margin.
   * Ride keeps 0-based / FTP zone domain when this is false.
   */
  zoomWattsToData?: boolean
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

type AxisSideLabels = {
  values: number[]
  /** Scale floor/ceiling for positioning labels on the plot. */
  domainMin: number
  domainMax: number
  format: (n: number, withUnit?: boolean) => string
}

/** CSS `top %` aligned with SVG y mapping (includes plot padding). */
function axisTickTopPct(
  value: number,
  domainMin: number,
  domainMax: number,
  padTopRatio: number,
  padBottomRatio: number,
): number {
  const span = Math.max(domainMax - domainMin, 1e-9)
  const clamped = Math.min(Math.max(value, domainMin), domainMax)
  const t = (domainMax - clamped) / span
  return (padTopRatio + t * (1 - padTopRatio - padBottomRatio)) * 100
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

/** Closed path under a series down to the scale floor (plan backdrop). */
function toAreaPath(
  points: Array<{ tSec: number; value: number }>,
  maxT: number,
  minV: number,
  maxV: number,
  width: number,
  height: number,
  pad: PlotPad,
): string {
  if (points.length < 2) return ''
  const line = toPoints(points, maxT, minV, maxV, width, height, pad)
  const x0 = xOf(points[0].tSec, maxT, width, pad).toFixed(1)
  const x1 = xOf(points[points.length - 1].tSec, maxT, width, pad).toFixed(1)
  const yBase = yOf(minV, minV, maxV, height, pad).toFixed(1)
  return `M ${x0},${yBase} L ${line} L ${x1},${yBase} Z`
}

function strokeWidth(tone: ChartSeries['tone']): number {
  switch (tone) {
    case 'achieved':
      return 2.9
    case 'planned':
      return 1.6
    case 'meter':
      return 1.75
    default:
      return 2.15
  }
}

/** Draw order: plan backdrop, then supporting lines, power last. */
function seriesPaintOrder(tone: ChartSeries['tone']): number {
  switch (tone) {
    case 'planned':
      return 0
    case 'meter':
      return 1
    case 'cadence':
      return 2
    case 'heartRate':
      return 3
    case 'achieved':
      return 4
  }
}

/** Measured watts lines get a light display-only smooth; plan stays stepped. */
const MEASURED_SMOOTH_WINDOW_SEC = 5

function displayPoints(series: ChartSeries): ChartPoint[] {
  if (
    series.scale === 'watts' &&
    (series.tone === 'achieved' || series.tone === 'meter')
  ) {
    return smoothChartPoints(series.points, MEASURED_SMOOTH_WINDOW_SEC)
  }
  return series.points
}

function formatBodyScale(
  scale: 'heartRate' | 'cadence',
): (n: number, withUnit?: boolean) => string {
  return scale === 'heartRate' ? formatAxisBpm : formatAxisRpm
}

function sideLabels(scale: ChartScale): AxisSideLabels | null {
  const domain = chartScaleDomain(scale)
  if (!domain || (scale !== 'heartRate' && scale !== 'cadence')) return null
  return {
    values: [...new Set(threeAxisTicks(domain.min, domain.max))].sort(
      (a, b) => b - a,
    ),
    domainMin: domain.min,
    domainMax: domain.max,
    format: formatBodyScale(scale),
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
  hideXAxis = false,
  zoomWattsToData = false,
}: Props) {
  const normalized = normalizeSeries(series).filter((s) => s.points.length >= 2)
  if (normalized.length < 1) {
    return <p className="muted">No Power Profile yet</p>
  }

  const painted = [...normalized].sort(
    (a, b) => seriesPaintOrder(a.tone) - seriesPaintOrder(b.tone),
  )

  const pad: PlotPad = { left: PAD_X, right: PAD_X, top: PAD_Y, bottom: PAD_Y }

  const allPoints = normalized.flatMap((s) => s.points)
  const maxT = Math.max(maxTSec ?? 0, ...allPoints.map((p) => p.tSec), 1)
  const wattsSeries = normalized.filter((s) => s.scale === 'watts')
  const wattsValues = wattsSeries.flatMap((s) => s.points.map((p) => p.value))
  const wattsDataMax = Math.max(1, ...wattsValues)
  const wattsDataMin = wattsValues.length > 0 ? Math.min(...wattsValues) : 0

  const wattsDomain =
    ftpWatts !== null && ftpWatts > 0
      ? {
          min: 0,
          max: powerAxisMaxWatts({ ftpWatts, dataMaxWatts: wattsDataMax }),
        }
      : zoomWattsToData
        ? wattsAxisDomain(wattsDataMin, wattsDataMax)
        : { min: 0, max: wattsDataMax }
  const wattsMin = wattsDomain.min
  const wattsMax = wattsDomain.max

  const bands =
    ftpWatts !== null && ftpWatts > 0 && wattsSeries.length > 0
      ? zoneBandRects(ftpWatts, wattsMax)
      : []

  const cursorX =
    cursorSec !== null && cursorSec !== undefined
      ? xOf(Math.min(cursorSec, maxT), maxT, width, pad)
      : null

  const hasWatts = wattsSeries.length > 0
  const bodySides = bodyChartAxisSides(normalized.map((s) => s.scale))
  const leftBody = bodySides.left ? sideLabels(bodySides.left) : null
  const rightBody = bodySides.right ? sideLabels(bodySides.right) : null

  const wattTicks = hasWatts
    ? [...new Set(niceAxisTicks(wattsMin, wattsMax, 5))].sort((a, b) => b - a)
    : []

  const leftAxis: AxisSideLabels | null = hasWatts
    ? {
        values: wattTicks,
        domainMin: wattsMin,
        domainMax: wattsMax,
        format: formatAxisWatts,
      }
    : leftBody

  const rightAxis: AxisSideLabels | null = hasWatts ? null : rightBody

  // Gridlines share the labeled Y ticks (nice watts, or body thirds).
  const gridMin = hasWatts
    ? wattsMin
    : leftBody
      ? leftBody.domainMin
      : null
  const gridMax = hasWatts
    ? wattsMax
    : leftBody
      ? leftBody.domainMax
      : null
  const yTicks =
    showAxes && gridMin !== null && gridMax !== null
      ? hasWatts
        ? [...wattTicks].sort((a, b) => a - b)
        : [...new Set(threeAxisTicks(gridMin, gridMax))]
      : []
  const xTicks = showAxes ? [...new Set(threeAxisTicks(0, maxT))] : []
  const plotLeft = pad.left
  const plotWidth = width - pad.left - pad.right

  const svg = (
    <svg
      className={
        showAxes
          ? 'power-profile-line session-power-chart-plot'
          : (className ?? 'power-profile-line')
      }
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
        return (
          <g key={`zone-${band.zone}`} className={`zone-band zone-band-z${band.zone}`}>
            <rect
              x={plotLeft}
              y={yTop}
              width={plotWidth}
              height={bandHeight}
            />
          </g>
        )
      })}
      {gridMin !== null &&
        gridMax !== null &&
        yTicks.map((tick) => {
          const y = yOf(tick, gridMin, gridMax, height, pad)
          return (
            <line
              key={`grid-y-${tick}`}
              className="axis-grid"
              x1={plotLeft}
              x2={plotLeft + plotWidth}
              y1={y}
              y2={y}
              vectorEffect="nonScalingStroke"
            />
          )
        })}
      {painted.map((s) => {
        const points = displayPoints(s)
        const fixed = chartScaleDomain(s.scale)
        const minV = s.scale === 'watts' ? wattsMin : (fixed?.min ?? 0)
        const maxV =
          s.scale === 'watts'
            ? wattsMax
            : (fixed?.max ?? Math.max(...points.map((p) => p.value), 1))
        const linePoints = toPoints(
          points,
          maxT,
          minV,
          maxV,
          width,
          height,
          pad,
        )
        return (
          <g key={`${s.tone}-${s.label}`}>
            {s.tone === 'planned' && (
              <path
                className="profile-series-area profile-series-area-planned"
                d={toAreaPath(
                  points,
                  maxT,
                  minV,
                  maxV,
                  width,
                  height,
                  pad,
                )}
              />
            )}
            <polyline
              className={`profile-series profile-series-${s.tone}`}
              fill="none"
              strokeWidth={strokeWidth(s.tone)}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="nonScalingStroke"
              points={linePoints}
            />
          </g>
        )
      })}
      {cursorX !== null && (
        <g className="profile-cursor-group">
          <rect
            className="profile-future-dim"
            x={cursorX}
            y={0}
            width={Math.max(width - cursorX, 0)}
            height={height}
          />
          <line
            className="profile-cursor profile-cursor-glow"
            x1={cursorX}
            x2={cursorX}
            y1={0}
            y2={height}
            strokeWidth="4"
            vectorEffect="nonScalingStroke"
          />
          <line
            className="profile-cursor"
            x1={cursorX}
            x2={cursorX}
            y1={0}
            y2={height}
            strokeWidth="1.75"
            vectorEffect="nonScalingStroke"
          />
        </g>
      )}
    </svg>
  )

  if (!showAxes) return svg

  const dualY = rightAxis !== null
  const padTopRatio = pad.top / height
  const padBottomRatio = pad.bottom / height
  const plotH = Math.max(height - pad.top - pad.bottom, 1)
  /** HTML rail — SVG text distorts under preserveAspectRatio=none. */
  const zoneRail =
    !dualY && bands.length > 0
      ? bands
          .map((band) => {
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
            if (bandHeight / plotH < 0.045) return null
            const midWatts = (band.minWatts + band.maxWatts) / 2
            return {
              zone: band.zone,
              name: band.name,
              topPct: axisTickTopPct(
                midWatts,
                wattsMin,
                wattsMax,
                padTopRatio,
                padBottomRatio,
              ),
            }
          })
          .filter((z): z is NonNullable<typeof z> => z !== null)
      : []

  return (
    <div
      className={`session-chart-axes${dualY ? ' session-chart-axes-dual-y' : ''}${zoneRail.length > 0 ? ' session-chart-axes-zones' : ''}${hideXAxis ? ' session-chart-axes-no-x' : ''} ${className ?? ''}`.trim()}
      role="img"
      aria-label={label}
    >
      {leftAxis && (
        <div className="session-chart-y session-chart-y-left" aria-hidden="true">
          {leftAxis.values.map((v, index) => (
            <span
              key={`y-left-${v}`}
              style={{
                top: `${axisTickTopPct(
                  v,
                  leftAxis.domainMin,
                  leftAxis.domainMax,
                  padTopRatio,
                  padBottomRatio,
                )}%`,
              }}
            >
              {leftAxis.format(v, index === 0)}
            </span>
          ))}
        </div>
      )}
      {svg}
      {rightAxis && (
        <div className="session-chart-y session-chart-y-right" aria-hidden="true">
          {rightAxis.values.map((v, index) => (
            <span
              key={`y-right-${v}`}
              style={{
                top: `${axisTickTopPct(
                  v,
                  rightAxis.domainMin,
                  rightAxis.domainMax,
                  padTopRatio,
                  padBottomRatio,
                )}%`,
              }}
            >
              {rightAxis.format(v, index === 0)}
            </span>
          ))}
        </div>
      )}
      {zoneRail.length > 0 && (
        <div className="session-chart-zones" aria-hidden="true">
          {zoneRail.map((z) => (
            <span
              key={`zone-rail-${z.zone}`}
              className={`session-chart-zone session-chart-zone-z${z.zone}`}
              style={{ top: `${z.topPct}%` }}
              title={z.name}
            >
              Z{z.zone}
            </span>
          ))}
        </div>
      )}
      {!hideXAxis && (
        <div className="session-chart-x" aria-hidden="true">
          {xTicks.map((tSec) => (
            <span key={`x-${tSec}`}>{formatAxisTime(tSec)}</span>
          ))}
        </div>
      )}
    </div>
  )
}
