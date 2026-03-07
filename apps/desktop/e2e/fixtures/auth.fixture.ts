import { test as mockApiTest, TEST_USER, TEST_TOKEN } from './mock-api.fixture'

type AuthFixtures = {
  authedPage: void
}

export const test = mockApiTest.extend<AuthFixtures>({
  authedPage: async ({ appPage, electronApp, mockApi }, use) => {
    // Inject auth state into Zustand persist store via localStorage
    await appPage.evaluate(
      ({ token, user }) => {
        const state = {
          state: { token, user },
          version: 0,
        }
        localStorage.setItem('auth-store', JSON.stringify(state))
      },
      { token: TEST_TOKEN, user: TEST_USER },
    )

    // Reload so the app picks up the persisted auth state
    await appPage.reload()
    await appPage.waitForLoadState('domcontentloaded')

    await use()
  },
})

export { expect } from '@playwright/test'
