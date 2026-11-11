import type { CalendarShape } from './calendarMarks'

type Props = {
  shape: CalendarShape
  filled?: boolean
  title: string
  /** Month-cell / legend chip, or the larger day-detail chip. */
  size?: 'mark' | 'row'
}

const LETTER: Record<CalendarShape, string> = {
  bicycle: 'B',
  run: 'R',
  gym: 'G',
  swim: 'W',
  social: 'E',
}

export function CalendarPictogram({
  shape,
  filled = false,
  title,
  size = 'mark',
}: Props) {
  const tone =
    shape === 'bicycle' ? (filled ? 'filled' : 'plan') : 'blocker'
  return (
    <span
      className={['cal-mark', `cal-mark-${size}`, 'cal-mark-chip', tone].join(
        ' ',
      )}
      role="img"
      aria-label={title}
      title={title}
    >
      <span className="cal-mark-letter" aria-hidden>
        {LETTER[shape]}
      </span>
    </span>
  )
}
