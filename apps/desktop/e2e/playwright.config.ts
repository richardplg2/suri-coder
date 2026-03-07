import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  projects: [
    {
      name: 'mock',
      testMatch: ['{flows,ui}/**/*.spec.ts'],
    },
    {
      name: 'integration',
      testMatch: ['integration/**/*.spec.ts'],
    },
  ],
})
