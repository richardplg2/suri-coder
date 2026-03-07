import { test, expect } from '../fixtures/auth.fixture'
import { API_BASE } from '../fixtures/mock-api.fixture'

const TEST_PROJECT = {
  id: 'proj-1',
  name: 'Test Project',
  slug: 'TEST-PROJE',
  path: '/tmp/test-project',
  repo_url: null,
  description: 'A test project',
  settings: null,
  created_by: 'test-user-id',
  created_at: '2026-01-01T00:00:00Z',
  member_count: 1,
}

test('create project via modal', async ({ appPage, authedPage }) => {
  // Mock the create and list endpoints
  await appPage.route(`${API_BASE}/projects`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(TEST_PROJECT),
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([TEST_PROJECT]),
      })
    }
  })

  // Click "New Project" button
  await appPage.getByRole('button', { name: /New Project/i }).first().click()

  // Fill in the create project modal
  await appPage.getByLabel('Name').fill('Test Project')
  await appPage.getByLabel('Path').fill('/tmp/test-project')

  // Submit
  await appPage.getByRole('button', { name: 'Create' }).click()

  // Project should appear (navigated to project tab)
  await expect(appPage.getByText('Test Project')).toBeVisible()
})
