import type { Activity, Blocker, BlockerKind, ScheduledRide } from '../api'
import { scheduledRidesBesideCompletedActivity } from './scheduledRidesBesideCompletedActivity'

export type CalendarShape = 'bicycle' | BlockerKind

export type CalendarMark = {
  id: string
  shape: CalendarShape
  filled: boolean
  title: string
}

const KIND_TITLE: Record<BlockerKind, string> = {
  social: 'Social',
  run: 'Run',
  gym: 'Gym',
  swim: 'Swim',
}

export function blockerTitle(blocker: Pick<Blocker, 'kind' | 'label'>): string {
  const label = blocker.label?.trim()
  return label ? label : KIND_TITLE[blocker.kind]
}

export function blockerWhen(blocker: Pick<Blocker, 'allDay' | 'startsAt' | 'durationMin'>): string {
  if (blocker.allDay) return 'All day'
  const clock = new Date(blocker.startsAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${clock} · ${blocker.durationMin ?? 0} min`
}

export function marksForDay(input: {
  scheduled: ScheduledRide[]
  activities: Activity[]
  blockers: Blocker[]
}): CalendarMark[] {
  const rides = scheduledRidesBesideCompletedActivity(
    input.scheduled,
    input.activities,
  )
  const marks: CalendarMark[] = []
  for (const ride of rides) {
    marks.push({
      id: ride.id,
      shape: 'bicycle',
      filled: false,
      title: ride.status === 'skipped' ? 'Skipped' : 'Scheduled',
    })
  }
  for (const activity of input.activities) {
    marks.push({
      id: activity.id,
      shape: 'bicycle',
      filled: true,
      title: 'Activity',
    })
  }
  for (const blocker of input.blockers) {
    marks.push({
      id: blocker.id,
      shape: blocker.kind,
      filled: false,
      title: blockerTitle(blocker),
    })
  }
  return marks
}
