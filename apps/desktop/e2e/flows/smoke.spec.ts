import { test, expect } from '../fixtures/app.fixture'

test('app launches and shows login screen', async ({ appPage }) => {
  await expect(appPage.getByRole('heading', { name: 'Sign in' })).toBeVisible()
})
