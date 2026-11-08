import { execFile, spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  session,
  shell,
  type WebContents,
} from 'electron'
import { loadCompanionEnv } from '../../companion/src/env.js'
import { OAUTH_RESULT_STORAGE_KEY } from '../../web/src/oauthResult.js'
import { BluetoothPicker } from './bluetooth.js'
import { installCadenceBridge } from './cadenceBridge.js'
import { DATA_DIR_NAME, SETTINGS_FILE_NAME, ensureSettingsFile, seedDataDir } from './dataDir.js'
import { teeConsoleToFile } from './logFile.js'
import { buildAppMenu } from './menu.js'
import { createDesktopServer, OAUTH_START_PATHS, type DesktopServer } from './server.js'

const DEFAULT_PORT = 8787
const PROJECT_URL = 'https://github.com/janpetr93/OpenTrainer'
const HELP_URL = `${PROJECT_URL}/blob/main/desktop/README.md`
const WINDOW_BACKGROUND = '#f4f6f8'

const isMac = process.platform === 'darwin'
const here = dirname(fileURLToPath(import.meta.url))
const assets = {
  webRoot: join(here, 'web'),
  sampleWorkouts: join(here, 'seed', 'workouts'),
  pickerHtml: join(here, 'picker', 'picker.html'),
  pickerPreload: join(here, 'picker-preload.cjs'),
  /** Developer fallback: the repo's companion/.env when running unpackaged. */
  repoEnv: join(here, '..', '..', 'companion', '.env'),
}

// Optional: run against another profile folder (tests, a second rider).
const userDataOverride = process.env.OPENTRAINER_USER_DATA_DIR
if (userDataOverride) app.setPath('userData', userDataOverride)
// ~/Library/Logs/OpenTrainer on macOS (also when run unpackaged), <userData>/logs elsewhere.
app.setAppLogsPath(
  userDataOverride
    ? join(userDataOverride, 'logs')
    : isMac
      ? join(app.getPath('home'), 'Library', 'Logs', app.getName())
      : undefined,
)

let server: DesktopServer | null = null
let mainWindow: BrowserWindow | null = null
let picker: BluetoothPicker | null = null
let stopCadence: (() => void) | null = null
let settingsPath = ''
let dataDir = ''

function log(message: string): void {
  console.log(message)
}

function parsePort(raw: string | undefined): number {
  const port = Number(raw)
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : DEFAULT_PORT
}

function openExternal(url: string): void {
  if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
}

function openInTextEditor(path: string): void {
  const fallback = () => void shell.openPath(path)
  if (isMac) {
    execFile('open', ['-t', path], (error) => error && fallback())
    return
  }
  if (process.platform === 'win32') {
    const child = spawn('notepad.exe', [path], { detached: true, stdio: 'ignore' })
    child.on('error', fallback)
    child.unref()
    return
  }
  fallback()
}

function focusWindow(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  if (isMac) app.focus({ steal: true })
}

/** Keep the app window on the local UI; everything else opens in the system browser. */
function guardNavigation(contents: WebContents, origin: string): void {
  contents.setWindowOpenHandler(({ url }) => {
    openExternal(url)
    return { action: 'deny' }
  })
  contents.on('will-attach-webview', (event) => event.preventDefault())
  contents.on('will-navigate', (event) => {
    let target: URL
    try {
      target = new URL(event.url)
    } catch {
      event.preventDefault()
      return
    }
    if (target.origin === origin) {
      // Strava and Google sign-in run in the system browser: Google blocks
      // embedded browsers, and the rider's saved logins live there.
      if (OAUTH_START_PATHS.has(target.pathname)) {
        event.preventDefault()
        openExternal(target.toString())
      }
      return
    }
    event.preventDefault()
    openExternal(target.toString())
  })
}

function createMainWindow(path = '/'): BrowserWindow {
  if (!server || !picker) throw new Error('Companion is not running')
  const origin = server.origin
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'OpenTrainer',
    backgroundColor: WINDOW_BACKGROUND,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
      preload: join(here, 'preload.cjs'),
      // No experimentalFeatures: it would expose navigator.bluetooth.getDevices(),
      // but Electron keeps no Web Bluetooth permissions between launches, so it
      // always returns [] and only makes macOS ask for Bluetooth at startup.
    },
  })
  mainWindow = win
  win.once('ready-to-show', () => win.show())
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })
  picker.attach(win)
  guardNavigation(win.webContents, origin)
  void win.loadURL(new URL(path, origin).toString())
  return win
}

/** After a checked sign-in, reload the app on the Profile result unless a ride is underway. */
async function showOAuthResult(search: string): Promise<void> {
  if (!server) return
  const path = search ? `/?${search}` : '/'
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (await rideIsActive(mainWindow)) {
      try {
        await rememberOAuthResult(mainWindow, search)
      } catch (error) {
        log(`OAuth result kept off the ride: ${String(error)}`)
      }
      focusWindow(mainWindow)
      return
    }
    void mainWindow.loadURL(new URL(path, server.origin).toString())
    focusWindow(mainWindow)
    return
  }
  focusWindow(createMainWindow(path))
}

async function rideIsActive(win: BrowserWindow): Promise<boolean> {
  try {
    return Boolean(
      await win.webContents.executeJavaScript(
        'document.documentElement.dataset.rideActive === "true"',
        true,
      ),
    )
  } catch {
    return false
  }
}

async function rememberOAuthResult(win: BrowserWindow, search: string): Promise<void> {
  const payload = JSON.stringify(search)
  await win.webContents.executeJavaScript(
    `sessionStorage.setItem(${JSON.stringify(OAUTH_RESULT_STORAGE_KEY)}, ${payload})`,
    true,
  )
}

async function isOpenTrainerAt(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
      signal: AbortSignal.timeout(1500),
    })
    const body = (await res.json()) as { ok?: unknown }
    return body.ok === true
  } catch {
    return false
  }
}

/** Bind the port, asking the rider to free it when something else holds it. */
async function listenOrAsk(desktop: DesktopServer): Promise<boolean> {
  for (;;) {
    try {
      await desktop.listen()
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error
    }
    const otherCompanion = await isOpenTrainerAt(desktop.port)
    const detail = otherCompanion
      ? `Another OpenTrainer companion is already running on port ${desktop.port}, ` +
        'probably ./start.sh or npm run dev in a terminal. Stop it, then try again.'
      : `Another program is using port ${desktop.port}. OpenTrainer needs this port for ` +
        'its local server and for the Strava and Google sign-in callbacks. Close that ' +
        'program, then try again.'
    const { response } = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Try Again', 'Quit'],
      defaultId: 0,
      cancelId: 1,
      message: `Port ${desktop.port} is already in use`,
      detail:
        `${detail}\n\nAdvanced: set D100_COMPANION_PORT in ${settingsPath} to use another ` +
        'port. Strava and Google redirect URIs must use the same port.',
    })
    if (response !== 0) return false
  }
}

async function start(): Promise<void> {
  const logFile = teeConsoleToFile(app.getPath('logs'))
  log(`OpenTrainer ${app.getVersion()} (Electron ${process.versions.electron}) starting`)
  log(`Log file: ${logFile}`)

  const userData = app.getPath('userData')
  settingsPath = join(userData, SETTINGS_FILE_NAME)
  await ensureSettingsFile(settingsPath)
  if (!app.isPackaged) loadCompanionEnv(assets.repoEnv)
  loadCompanionEnv(settingsPath)

  dataDir = process.env.D100_DATA_DIR || join(userData, DATA_DIR_NAME)
  if (await seedDataDir(dataDir, assets.sampleWorkouts)) {
    log(`Created Local Store with sample workouts: ${dataDir}`)
  }

  server = await createDesktopServer({
    dataDir,
    webRoot: assets.webRoot,
    port: parsePort(process.env.D100_COMPANION_PORT),
    onOAuthReturn: showOAuthResult,
    log,
  })
  if (!(await listenOrAsk(server))) {
    server = null
    app.quit()
    return
  }

  const origin = server.origin
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback, details) => {
    callback(details.requestingUrl.startsWith(`${origin}/`))
  })

  picker = new BluetoothPicker({ html: assets.pickerHtml, preload: assets.pickerPreload }, log)
  picker.installPairingHandler(session.defaultSession, () => mainWindow)
  if (process.platform === 'darwin') {
    stopCadence = installCadenceBridge({
      helperPath: join(
        app.isPackaged ? process.resourcesPath : here,
        'native',
        'cadence-bridge',
      ),
      picker,
      parent: () => mainWindow,
      log,
    }).stop
  }

  Menu.setApplicationMenu(
    buildAppMenu({
      openSettings: () => openInTextEditor(settingsPath),
      showDataFolder: () => void shell.openPath(dataDir),
      showLogs: () => shell.showItemInFolder(logFile),
      restart: () => {
        app.relaunch()
        app.quit()
      },
      openHelp: () => openExternal(HELP_URL),
      openProject: () => openExternal(PROJECT_URL),
    }),
  )

  createMainWindow()
  void server.reconcileCalendarMirror()
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.setAboutPanelOptions({
    applicationName: 'OpenTrainer',
    applicationVersion: app.getVersion(),
    copyright: 'MIT License © 2026 Jan Petr',
    website: PROJECT_URL,
  })

  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) focusWindow(mainWindow)
    else if (server && picker) createMainWindow()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && server && picker) createMainWindow()
  })

  app.on('window-all-closed', () => {
    if (!isMac) app.quit()
  })

  app.on('will-quit', (event) => {
    stopCadence?.()
    stopCadence = null
    const running = server
    if (!running) return
    server = null
    event.preventDefault()
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2000))
    void Promise.race([running.close(), timeout]).finally(() => app.quit())
  })

  app
    .whenReady()
    .then(start)
    .catch((error: unknown) => {
      const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
      console.error(message)
      dialog.showErrorBox(
        'OpenTrainer could not start',
        `${message}\n\nLogs: ${app.getPath('logs')}`,
      )
      app.exit(1)
    })
}
