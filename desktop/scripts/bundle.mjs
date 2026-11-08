// Bundle the Electron main process (with the companion), the picker window,
// and copy the built web UI plus sample workouts into desktop/dist/.
// Run `npm run build:web` first (or `npm run build`, which does both).
import { spawnSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const desktopRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = join(desktopRoot, '..')
const dist = join(desktopRoot, 'dist')
const webDist = join(repoRoot, 'web', 'dist')
const sampleWorkouts = join(repoRoot, 'companion', 'data', 'workouts')

if (!existsSync(join(webDist, 'index.html'))) {
  console.error('web/dist is missing. Run `npm run build --prefix web` first.')
  process.exit(1)
}

rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })

const common = {
  bundle: true,
  logLevel: 'warning',
  legalComments: 'none',
  absWorkingDir: desktopRoot,
}

await Promise.all([
  // Main process: ESM so the companion's import.meta.url keeps working.
  build({
    ...common,
    entryPoints: ['src/main.ts'],
    outfile: 'dist/main.js',
    platform: 'node',
    format: 'esm',
    target: 'node22',
    external: ['electron'],
    sourcemap: 'linked',
    banner: {
      js: "import { createRequire as __otCreateRequire } from 'node:module'; const require = __otCreateRequire(import.meta.url);",
    },
  }),
  // Sandboxed preloads must be CommonJS.
  build({
    ...common,
    entryPoints: ['src/picker/preload.ts'],
    outfile: 'dist/picker-preload.cjs',
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron'],
  }),
  build({
    ...common,
    entryPoints: ['src/preload.ts'],
    outfile: 'dist/preload.cjs',
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['electron'],
  }),
  build({
    ...common,
    entryPoints: ['src/picker/picker.ts'],
    outfile: 'dist/picker/picker.js',
    platform: 'browser',
    format: 'iife',
    target: 'chrome130',
  }),
])

for (const file of ['picker.html', 'picker.css']) {
  cpSync(join(desktopRoot, 'src', 'picker', file), join(dist, 'picker', file))
}
cpSync(webDist, join(dist, 'web'), { recursive: true })

mkdirSync(join(dist, 'seed', 'workouts'), { recursive: true })
for (const name of readdirSync(sampleWorkouts)) {
  if (/^sample-.*\.json$/.test(name)) {
    cpSync(join(sampleWorkouts, name), join(dist, 'seed', 'workouts', name))
  }
}

const nativeDir = join(dist, 'native')
mkdirSync(nativeDir, { recursive: true })
if (process.platform === 'darwin') {
  const source = join(desktopRoot, 'native', 'cadence-bridge.swift')
  const plist = join(desktopRoot, 'native', 'Info.plist')
  const linkArgs = [
    '-Xlinker',
    '-sectcreate',
    '-Xlinker',
    '__TEXT',
    '-Xlinker',
    '__info_plist',
    '-Xlinker',
    plist,
  ]
  const arm = join(nativeDir, 'cadence-bridge-arm64')
  const intel = join(nativeDir, 'cadence-bridge-x64')
  const out = join(nativeDir, 'cadence-bridge')
  const compile = (target, dest) =>
    spawnSync('swiftc', ['-target', target, '-O', '-o', dest, source, ...linkArgs], {
      stdio: 'inherit',
    })
  const armResult = compile('arm64-apple-macosx14.0', arm)
  if (armResult.status !== 0) process.exit(armResult.status ?? 1)
  const intelResult = compile('x86_64-apple-macosx14.0', intel)
  if (intelResult.status !== 0) process.exit(intelResult.status ?? 1)
  const lipo = spawnSync('lipo', ['-create', '-output', out, arm, intel], { stdio: 'inherit' })
  if (lipo.status !== 0) process.exit(lipo.status ?? 1)
  rmSync(arm, { force: true })
  rmSync(intel, { force: true })
  chmodSync(out, 0o755)
}

console.log('desktop/dist ready')
