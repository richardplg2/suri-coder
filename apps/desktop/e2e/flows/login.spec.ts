import { test, expect } from '../fixtures/mock-api.fixture'

test('login with valid credentials redirects to home', async ({
  appPage,
  mockApi,
}) => {
  await appPage.getByLabel('Email').fill('test@example.com')
  await appPage.getByLabel('Password').fill('password123')
  await appPage.getByRole('button', { name: 'Sign In' }).click()

  // Should redirect to home and show Projects heading
  await expect(appPage.getByRole('heading', { name: 'Projects' })).toBeVisible()
})

test('login with invalid credentials shows error', async ({
  appPage,
  mockApi,
}) => {
  // Override the login mock to return 401
  await appPage.route('http://localhost:8000/auth/login', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Invalid email or password' }),
    })
  })

  await appPage.getByLabel('Email').fill('wrong@example.com')
  await appPage.getByLabel('Password').fill('wrongpass')
  await appPage.getByRole('button', { name: 'Sign In' }).click()

  // Should show error message
  await expect(appPage.getByText('Invalid email or password')).toBeVisible()
})
