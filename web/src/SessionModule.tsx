import type { ReactNode } from 'react'
import { PowerProfileLine, type PowerProfileSeries } from './PowerProfileLine'
import type { SessionMeta } from './session/sessionModuleHelpers'

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
}

const CHART_HEIGHT = 240

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
            <span className="legend-planned">Plan</span>
            <span className="legend-achieved">Achieved</span>
          </p>
        )}
      </div>
    </li>
  )
}
