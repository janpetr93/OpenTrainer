import type { ReactNode } from 'react'
import type { TimeInZonesSec } from './api'
import { SERIES_TONE_LABEL } from './chart/metricSeries'
import { PowerProfileLine, type PowerProfileSeries } from './PowerProfileLine'
import { formatDuration, type SessionMeta } from './session/sessionModuleHelpers'

type Props = {
  title: string
  meta: SessionMeta
  purpose?: string | null
  actions: ReactNode
  chartLabel: string
  series: PowerProfileSeries[]
  /** When true, show FTP gate instead of a zero-watt planned chart. */
  needsFtpToPreview?: boolean
  showLegend?: boolean
  /** Seconds spent in each Power Zone. Activities only. */
  timeInZonesSec?: TimeInZonesSec | null
}

const CHART_HEIGHT = 240

const ZONE_IDS = [1, 2, 3, 4, 5, 6, 7] as const

function ZoneTimeBar({ seconds }: { seconds: TimeInZonesSec | null }) {
  if (!seconds) return null
  const parts = ZONE_IDS.filter((zone) => seconds[zone] > 0)
  if (parts.length === 0) return null
  const label = parts
    .map((zone) => `Z${zone} ${formatDuration(seconds[zone])}`)
    .join(', ')
  return (
    <div className="zone-time" role="img" aria-label={`Time in zones: ${label}`}>
      {parts.map((zone) => (
        <span
          key={zone}
          className={`zone-time-z${zone}`}
          style={{ flexGrow: seconds[zone] }}
          title={`Z${zone} ${formatDuration(seconds[zone])}`}
        />
      ))}
    </div>
  )
}

/** Shared Scheduled Ride / Activity row chrome across Ride, History, Calendar. */
export function SessionModule({
  title,
  meta,
  purpose = null,
  actions,
  chartLabel,
  series,
  needsFtpToPreview = false,
  showLegend = false,
  timeInZonesSec = null,
}: Props) {
  const showChart = !needsFtpToPreview && series.length > 0
  const showWhenRow = Boolean(meta.when || meta.kind)

  return (
    <li className="session-row">
      <div className="session-row-main">
        <div className="session-row-heading">
          <strong className="session-title">{title}</strong>
          {showWhenRow ? (
            <p className="session-meta-when muted">
              {meta.when ? <span>{meta.when}</span> : null}
              {meta.when && meta.kind ? (
                <span className="session-meta-sep" aria-hidden="true">
                  ·
                </span>
              ) : null}
              {meta.kind ? (
                <span className="session-meta-kind">{meta.kind}</span>
              ) : null}
            </p>
          ) : null}
          {meta.metrics.length > 0 ? (
            <dl className="session-metrics">
              {meta.metrics.map((metric) => (
                <div key={metric.label} className="session-metric">
                  <dt>{metric.label}</dt>
                  <dd>{metric.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {purpose ? <p className="session-purpose">{purpose}</p> : null}
          <ZoneTimeBar seconds={timeInZonesSec} />
        </div>
        <div className="session-row-actions">{actions}</div>
      </div>
      <div className="session-row-chart">
        {needsFtpToPreview ? (
          <p className="muted session-ftp-gate">
            Set FTP via MCP (set_ftp) to preview plan.
          </p>
        ) : (
          showChart && (
            <PowerProfileLine
              className="session-power-chart"
              label={chartLabel}
              height={CHART_HEIGHT}
              series={series}
              showAxes
              zoomWattsToData
            />
          )
        )}
        {showLegend && showChart && (
          <p className="chart-legend muted">
            {series.map((s, index) => {
              const tone = s.tone ?? (index === 0 ? 'planned' : 'achieved')
              return (
                <span key={tone} className={`legend-${tone}`}>
                  {tone === 'achieved' ? 'Achieved' : SERIES_TONE_LABEL[tone]}
                </span>
              )
            })}
          </p>
        )}
      </div>
    </li>
  )
}
