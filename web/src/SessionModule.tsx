import type { ReactNode } from 'react'
import { PowerProfileLine, type PowerProfileSeries } from './PowerProfileLine'

type Props = {
  title: string
  secondary: string
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
  secondary,
  purpose = null,
  actions,
  chartLabel,
  series,
  needsFtpToPreview = false,
  showLegend = false,
}: Props) {
  const showChart = !needsFtpToPreview && series.length > 0

  return (
    <li className="session-row">
      <div className="session-row-main">
        <div className="session-row-heading">
          <strong>{title}</strong>
          <span className="muted">{secondary}</span>
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
              className="power-profile-line session-power-chart"
              label={chartLabel}
              height={CHART_HEIGHT}
              series={series}
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
