import { Menu, type MenuItemConstructorOptions } from 'electron'

export type MenuActions = {
  openSettings(): void
  showDataFolder(): void
  showLogs(): void
  restart(): void
  openHelp(): void
  openProject(): void
}

export function buildAppMenu(actions: MenuActions): Menu {
  const isMac = process.platform === 'darwin'

  const appItems: MenuItemConstructorOptions[] = [
    {
      label: 'Integrations Settings…',
      accelerator: 'CmdOrCtrl+,',
      click: () => actions.openSettings(),
    },
    { label: 'Show Data Folder', click: () => actions.showDataFolder() },
    { type: 'separator' },
    { label: 'Restart OpenTrainer', click: () => actions.restart() },
  ]

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            role: 'appMenu' as const,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              ...appItems,
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : [
          {
            label: '&File',
            submenu: [...appItems, { type: 'separator' as const }, { role: 'quit' as const }],
          },
        ]),
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    {
      role: 'help',
      submenu: [
        { label: 'Desktop App Help', click: () => actions.openHelp() },
        { label: 'OpenTrainer on GitHub', click: () => actions.openProject() },
        { type: 'separator' },
        { label: 'Show Logs', click: () => actions.showLogs() },
      ],
    },
  ]

  return Menu.buildFromTemplate(template)
}
