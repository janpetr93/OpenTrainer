import { randomBytes } from 'node:crypto'

const TTL_MS = 2 * 60 * 1000

export type OAuthHandoff = {
  issue(): string
  consume(token: string | null): boolean
}

/** One-time tokens the desktop return page must present before the app reloads. */
export function createOAuthHandoff(now: () => number = Date.now): OAuthHandoff {
  const pending = new Map<string, number>()
  return {
    issue() {
      const at = now()
      for (const [token, expires] of pending) {
        if (expires <= at) pending.delete(token)
      }
      const token = randomBytes(16).toString('hex')
      pending.set(token, at + TTL_MS)
      return token
    },
    consume(token) {
      if (!token) return false
      const expires = pending.get(token)
      pending.delete(token)
      return expires !== undefined && expires > now()
    },
  }
}
