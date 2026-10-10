import { describe, expect, it } from 'vitest'
import { formatStravaApiError } from './client.js'

describe('formatStravaApiError', () => {
  it('explains Inactive Application Status', () => {
    const text = formatStravaApiError(
      403,
      {
        message: 'Forbidden',
        errors: [{ resource: 'Application', field: 'Status', code: 'Inactive' }],
      },
      'Strava upload failed',
    )
    expect(text).toContain('Forbidden')
    expect(text).toContain('Application Status Inactive')
    expect(text).toMatch(/reactivate|subscription/i)
  })
})
