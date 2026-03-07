import { test as base, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { resolve } from 'node:path'

type AppFixtures = {
  electronApp: ElectronApplication
  appPage: Page
}

export const test = base.extend<AppFixtures>({
  electronApp: async ({}, use) => {
    const appPath = resolve(__dirname, '../../node_modules/.dev/main/index.mjs')
    const electronApp = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    })
    await use(electronApp)
    await electronApp.close()
  },

  appPage: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    // Clear persisted state from previous test runs
    await page.evaluate(() => localStorage.clear())
    await use(page)
  },
})

export { expect } from '@playwright/test'
