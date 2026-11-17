import { describe, expect, it } from 'vitest'
import { stepRuns } from './stepRuns'

describe('stepRuns', () => {
  it('holds a value until a clear, then starts again', () => {
    expect(
      stepRuns(
        [
          { date: '2026-01-10', watts: 240 },
          { date: '2026-03-01', watts: 240 },
          { date: '2026-04-01', watts: null },
          { date: '2026-05-01', watts: 250 },
        ],
        '2026-06-01',
      ),
    ).toEqual([
      [
        { date: '2026-01-10', watts: 240 },
        { date: '2026-03-01', watts: 240 },
        { date: '2026-04-01', watts: 240 },
      ],
      [
        { date: '2026-05-01', watts: 250 },
        { date: '2026-06-01', watts: 250 },
      ],
    ])
  })

  it('steps up at the date the watts change', () => {
    expect(
      stepRuns(
        [
          { date: '2026-01-10', watts: 240 },
          { date: '2026-03-01', watts: 255 },
        ],
        '2026-06-01',
      ),
    ).toEqual([
      [
        { date: '2026-01-10', watts: 240 },
        { date: '2026-03-01', watts: 240 },
        { date: '2026-03-01', watts: 255 },
        { date: '2026-06-01', watts: 255 },
      ],
    ])
  })

  it('draws a single vertex when the only step is today', () => {
    expect(stepRuns([{ date: '2026-06-01', watts: 250 }], '2026-06-01')).toEqual([
      [{ date: '2026-06-01', watts: 250 }],
    ])
  })
})
