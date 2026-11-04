import { createWriteStream, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { format } from 'node:util'

const MAX_LOG_BYTES = 5 * 1024 * 1024

/**
 * Copy console output into `<logsDir>/main.log`. A packaged app has no
 * terminal, so this is where companion startup lines and errors end up.
 */
export function teeConsoleToFile(logsDir: string): string {
  mkdirSync(logsDir, { recursive: true })
  const file = join(logsDir, 'main.log')
  try {
    if (statSync(file).size > MAX_LOG_BYTES) renameSync(file, join(logsDir, 'main.old.log'))
  } catch {
    // No log yet.
  }
  const stream = createWriteStream(file, { flags: 'a' })
  stream.on('error', () => {})

  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      stream.write(`${new Date().toISOString()} ${level.toUpperCase()} ${format(...args)}\n`)
      original(...args)
    }
  }
  return file
}
