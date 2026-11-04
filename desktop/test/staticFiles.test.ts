import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contentTypeFor, resolveStaticPath } from '../src/staticFiles.js'

describe('resolveStaticPath', () => {
  const root = resolve('/srv/web')

  it('maps URL paths inside the web root', () => {
    expect(resolveStaticPath(root, '/')).toBe(root)
    expect(resolveStaticPath(root, '/assets/app.js')).toBe(join(root, 'assets', 'app.js'))
    expect(resolveStaticPath(root, '/a%20b.svg')).toBe(join(root, 'a b.svg'))
  })

  it('refuses paths that escape the root or are malformed', () => {
    expect(resolveStaticPath(root, '/../etc/passwd')).toBeNull()
    expect(resolveStaticPath(root, '/%2e%2e/%2e%2e/etc/passwd')).toBeNull()
    expect(resolveStaticPath(root, '/..%5c..%5csecret')).toBeNull()
    expect(resolveStaticPath(root, '/%E0%A4%A')).toBeNull()
    expect(resolveStaticPath(root, '/a%00.js')).toBeNull()
  })
})

describe('contentTypeFor', () => {
  it('knows the web build file types', () => {
    expect(contentTypeFor('index.html')).toContain('text/html')
    expect(contentTypeFor('app.JS')).toContain('text/javascript')
    expect(contentTypeFor('favicon.svg')).toBe('image/svg+xml')
    expect(contentTypeFor('blob.bin')).toBe('application/octet-stream')
  })
})
