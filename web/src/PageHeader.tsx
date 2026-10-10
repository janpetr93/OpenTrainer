import type { ReactNode } from 'react'

type Props = {
  title: string
  /** One status line under the title (sensors, Bluetooth, companion…). */
  status?: ReactNode
  /** Optional one-line muted guidance under status. */
  blurb?: ReactNode
}

/** Shared tab page header: title · status · optional blurb. */
export function PageHeader({ title, status, blurb }: Props) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {status != null ? <div className="page-header-status">{status}</div> : null}
      {blurb != null ? <p className="page-header-blurb muted">{blurb}</p> : null}
    </header>
  )
}
