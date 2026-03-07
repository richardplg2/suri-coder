import { test, expect } from '../fixtures/auth.fixture'

test('authenticated user sees home screen with projects heading', async ({
  appPage,
  authedPage,
}) => {
  await expect(appPage.getByRole('heading', { name: 'Projects' })).toBeVisible()
})

test('authenticated user sees New Project button', async ({
  appPage,
  authedPage,
}) => {
  await expect(
    appPage.getByRole('button', { name: /New Project/i }).first(),
  ).toBeVisible()
})
