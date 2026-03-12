import { test as appTest, expect } from './app.fixture'

type IntegrationFixtures = {
  backendReady: void
}

export const test = appTest.extend<IntegrationFixtures>({
  backendReady: async ({ }, use) => {
    // Verify backend is running
    const res = await fetch('http://localhost:8001/health')
    if (!res.ok) {
      throw new Error(
        'Backend not running. Start with: pnpm docker:up && cd apps/backend && uv run fastapi dev app/main.py --port 8001',
      )
    }
    await use()
  },
})

export { expect }
