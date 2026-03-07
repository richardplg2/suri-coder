import { test, expect } from '../fixtures/integration.fixture'

test('login with real backend credentials', async ({
  appPage,
  backendReady,
}) => {
  await appPage.getByLabel('Email').fill('test@example.com')
  await appPage.getByLabel('Password').fill('test1234')
  await appPage.getByRole('button', { name: 'Sign In' }).click()

  // Should redirect to home screen
  await expect(appPage.getByRole('heading', { name: 'Projects' })).toBeVisible({ timeout: 10_000 })
})
