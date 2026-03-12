import { test as appTest } from './app.fixture'
import type { Page } from '@playwright/test'

const API_BASE = 'http://localhost:8001'

const TEST_USER = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  avatar_url: null,
  role: 'admin',
  created_at: '2026-01-01T00:00:00Z',
}

const TEST_TOKEN = 'test-jwt-token'

const DEFAULT_RESPONSES: Record<string, { status: number; body: unknown }> = {
  'POST /auth/login': {
    status: 200,
    body: { access_token: TEST_TOKEN, token_type: 'bearer', user: TEST_USER },
  },
  'GET /projects/': {
    status: 200,
    body: [],
  },
  'GET /health': {
    status: 200,
    body: { status: 'ok' },
  },
}

function normalizeKey(method: string, pathname: string): string {
  // Normalize to match with and without trailing slash
  const normalized = pathname.replace(/\/+$/, '')
  return `${method} ${normalized}`
}

async function setupMockApi(page: Page) {
  await page.route(`${API_BASE}/**`, async (route) => {
    const request = route.request()
    const method = request.method()
    const url = new URL(request.url())
    const key = normalizeKey(method, url.pathname)

    // Try normalized key, then with trailing slash
    const response =
      DEFAULT_RESPONSES[key] ||
      DEFAULT_RESPONSES[`${key}/`]

    if (response) {
      await route.fulfill({
        status: response.status,
        contentType: 'application/json',
        body: JSON.stringify(response.body),
      })
    } else {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ detail: `Mock not found: ${key}` }),
      })
    }
  })
}

type MockApiFixtures = {
  mockApi: void
}

export const test = appTest.extend<MockApiFixtures>({
  mockApi: async ({ appPage }, use) => {
    await setupMockApi(appPage)
    await use()
  },
})

export { expect } from '@playwright/test'
export { TEST_USER, TEST_TOKEN, API_BASE }
