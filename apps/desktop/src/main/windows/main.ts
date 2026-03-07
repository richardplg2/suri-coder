import { BrowserWindow } from 'electron'
import { join } from 'node:path'

import { createWindow } from 'lib/electron-app/factories/windows/create'
import { ENVIRONMENT } from 'shared/constants'
import { displayName } from '~/package.json'

export async function MainWindow() {
  const isMac = process.platform === 'darwin'

  const window = createWindow({
    id: 'main',
    title: displayName,
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    center: true,
    movable: true,
    resizable: true,
    autoHideMenuBar: true,
    backgroundColor: '#1E1E1E',

    ...(isMac && {
      titleBarStyle: 'hiddenInset' as const,
      trafficLightPosition: { x: 16, y: 12 },
      vibrancy: 'sidebar' as const,
    }),

    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
    },
  })

  window.webContents.on('did-finish-load', () => {
    if (ENVIRONMENT.IS_DEV) {
      window.webContents.openDevTools({ mode: 'detach' })
    }

    window.show()
  })

  window.on('close', () => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.destroy()
    }
  })

  return window
}
