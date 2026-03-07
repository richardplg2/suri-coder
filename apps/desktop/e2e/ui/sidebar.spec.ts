import { test, expect } from '../fixtures/auth.fixture'

test('sidebar is visible on home screen', async ({ appPage, authedPage }) => {
  await expect(appPage.locator('aside')).toBeVisible()
})

test('sidebar shows All Projects section', async ({ appPage, authedPage }) => {
  await expect(appPage.getByText('All Projects')).toBeVisible()
})
