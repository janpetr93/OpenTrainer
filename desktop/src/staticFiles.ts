import { createReadStream, type Stats } from 'node:fs'
import { stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

export function contentTypeFor(filePath: string): string {
  return MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

/**
 * Map a URL pathname onto a file under `webRoot`.
 * Returns null when the path is malformed or escapes the root.
 */
export function resolveStaticPath(webRoot: string, pathname: string): string | null {
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  // Backslashes are path separators on Windows; the web build never uses them.
  if (decoded.includes('\0') || decoded.includes('\\')) return null
  const root = resolve(webRoot)
  const relative = decoded.replace(/^\/+/, '')
  const target = resolve(root, relative)
  if (target !== root && !target.startsWith(root + sep)) return null
  return target
}

async function fileStats(path: string): Promise<Stats | null> {
  try {
    return await stat(path)
  } catch {
    return null
  }
}

function sendPlain(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(body)
}

/**
 * Serve the built web UI. Unknown paths without a file extension fall back to
 * `index.html` so a reload on any in-app URL still opens the app.
 */
export async function serveStatic(
  req: IncomingMessage,
  res: ServerResponse,
  webRoot: string,
  pathname: string,
): Promise<void> {
  const method = req.method ?? 'GET'
  if (method !== 'GET' && method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' })
    res.end()
    return
  }

  const resolved = resolveStaticPath(webRoot, pathname)
  if (!resolved) {
    sendPlain(res, 400, 'Bad request')
    return
  }
  let filePath: string = resolved

  let info = await fileStats(filePath)
  if (info?.isDirectory()) {
    filePath = join(filePath, 'index.html')
    info = await fileStats(filePath)
  }
  if (!info?.isFile()) {
    if (extname(pathname) !== '') {
      sendPlain(res, 404, 'Not found')
      return
    }
    filePath = join(resolve(webRoot), 'index.html')
    info = await fileStats(filePath)
    if (!info?.isFile()) {
      sendPlain(res, 500, 'Web UI build is missing. Run `npm run build --prefix web`.')
      return
    }
  }

  const immutable = pathname.startsWith('/assets/')
  res.writeHead(200, {
    'Content-Type': contentTypeFor(filePath),
    'Content-Length': info.size,
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  })
  if (method === 'HEAD') {
    res.end()
    return
  }
  const stream = createReadStream(filePath)
  stream.on('error', () => res.destroy())
  stream.pipe(res)
}
