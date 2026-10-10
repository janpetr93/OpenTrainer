import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const companionRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..')

/** Default on-disk Local Store root (repo companion/data). */
export const defaultDataDir = join(companionRoot, 'data')

export function resolveDataDir(explicit?: string): string {
  return explicit ?? process.env.D100_DATA_DIR ?? defaultDataDir
}
