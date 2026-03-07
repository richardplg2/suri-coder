import { test, expect } from '../fixtures/auth.fixture'
import { API_BASE, TEST_TOKEN, TEST_USER } from '../fixtures/mock-api.fixture'

const TEST_PROJECT_ID = 'proj-brainstorm-1'
const TEST_SESSION_ID = 'session-bs-1'

const INITIAL_MESSAGE = {
  id: 'msg-init-1',
  session_id: TEST_SESSION_ID,
  role: 'assistant' as const,
  message_type: 'text' as const,
  content: 'Welcome! Let me help you brainstorm your project idea.',
  structured_data: null,
  created_at: '2026-01-01T00:00:01Z',
}

const ASSISTANT_REPLY = {
  id: 'msg-reply-1',
  session_id: TEST_SESSION_ID,
  role: 'assistant' as const,
  message_type: 'text' as const,
  content: 'That sounds like an interesting idea. Can you tell me more?',
  structured_data: null,
  created_at: '2026-01-01T00:00:03Z',
}

const QUIZ_MESSAGE = {
  id: 'msg-quiz-1',
  session_id: TEST_SESSION_ID,
  role: 'assistant' as const,
  message_type: 'quiz' as const,
  content: null,
  structured_data: {
    question: 'What type of application are you building?',
    context: 'This will help determine the best architecture.',
    options: [
      {
        id: 'opt-1',
        label: 'Web Application',
        description: 'A browser-based application',
        recommended: true,
        recommendation_reason: 'Most common choice',
      },
      {
        id: 'opt-2',
        label: 'Mobile App',
        description: 'iOS or Android native app',
        recommended: false,
        recommendation_reason: null,
      },
      {
        id: 'opt-3',
        label: 'Desktop App',
        description: 'A desktop application using Electron',
        recommended: false,
        recommendation_reason: null,
      },
    ],
    allow_multiple: false,
    allow_custom: true,
  },
  created_at: '2026-01-01T00:00:05Z',
}

const SUMMARY_MESSAGE = {
  id: 'msg-summary-1',
  session_id: TEST_SESSION_ID,
  role: 'assistant' as const,
  message_type: 'summary' as const,
  content: 'Here is a summary of the brainstorm session with key outcomes.',
  structured_data: null,
  created_at: '2026-01-01T00:00:10Z',
}

/**
 * Helper to inject brainstorm tab + auth into localStorage, set up common API
 * mocks, and reload the page so the BrainstormScreen mounts.
 *
 * Uses the default mocks: brainstorm/start returns INITIAL_MESSAGE,
 * brainstorm/:sid/message returns ASSISTANT_REPLY.
 *
 * Override-specific routes *before* calling this function if you want
 * different start/message behaviour.
 */
async function openBrainstormTab(
  appPage: import('@playwright/test').Page,
  overrides?: {
    /** Skip registering the default brainstorm/start route */
    skipStartRoute?: boolean
    /** Skip registering the default brainstorm/:sid/message route */
    skipMessageRoute?: boolean
  },
) {
  // Register default mocks unless the caller already did so
  if (!overrides?.skipStartRoute) {
    await appPage.route(
      `${API_BASE}/projects/${TEST_PROJECT_ID}/brainstorm/start`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            session_id: TEST_SESSION_ID,
            initial_message: INITIAL_MESSAGE,
          }),
        })
      },
    )
  }

  if (!overrides?.skipMessageRoute) {
    await appPage.route(
      `${API_BASE}/projects/${TEST_PROJECT_ID}/brainstorm/${TEST_SESSION_ID}/message`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ message: ASSISTANT_REPLY }),
        })
      },
    )
  }

  // Inject both auth-store and tab-store, then reload so the app picks up both
  await appPage.evaluate(
    ({ projectId, token, user }) => {
      localStorage.setItem(
        'auth-store',
        JSON.stringify({ state: { token, user }, version: 0 }),
      )
      localStorage.setItem(
        'tab-store',
        JSON.stringify({
          state: {
            tabs: [
              { id: 'home', type: 'home', label: 'Home', pinned: true },
              {
                id: 'brainstorm-test',
                type: 'brainstorm',
                projectId,
                label: 'Brainstorm',
                pinned: false,
              },
            ],
            activeTabId: 'brainstorm-test',
          },
          version: 0,
        }),
      )
    },
    { projectId: TEST_PROJECT_ID, token: TEST_TOKEN, user: TEST_USER },
  )

  await appPage.reload()
  await appPage.waitForLoadState('domcontentloaded')
}

// ============================================================
// Tests
// ============================================================

test.describe('Brainstorm Screen', () => {
  test('session initializes on mount and shows initial message', async ({
    appPage,
    authedPage,
  }) => {
    await openBrainstormTab(appPage)

    await expect(
      appPage.getByText('Welcome! Let me help you brainstorm your project idea.'),
    ).toBeVisible()
  })

  test('displays error state when brainstorm start fails', async ({
    appPage,
    authedPage,
  }) => {
    // Register failing start route BEFORE openBrainstormTab
    await appPage.route(
      `${API_BASE}/projects/${TEST_PROJECT_ID}/brainstorm/start`,
      async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Internal server error' }),
        })
      },
    )

    await openBrainstormTab(appPage, { skipStartRoute: true })

    // Error message should appear
    await expect(
      appPage.getByText('Failed to start brainstorm session. Please try again.'),
    ).toBeVisible()

    // Retry button should be visible
    await expect(appPage.getByRole('button', { name: 'Retry' })).toBeVisible()
  })

  test('user can type a message and send via Enter key', async ({
    appPage,
    authedPage,
  }) => {
    await openBrainstormTab(appPage)

    await expect(
      appPage.getByText('Welcome! Let me help you brainstorm your project idea.'),
    ).toBeVisible()

    const messageInput = appPage.getByPlaceholder('Type your message...')
    await messageInput.fill('I want to build a task manager')
    await messageInput.press('Enter')

    // The user message should appear as a chat bubble
    await expect(appPage.getByText('I want to build a task manager')).toBeVisible()

    // Input should be cleared after sending
    await expect(messageInput).toHaveValue('')
  })

  test('user can type a message and send via Send button', async ({
    appPage,
    authedPage,
  }) => {
    await openBrainstormTab(appPage)

    await expect(
      appPage.getByText('Welcome! Let me help you brainstorm your project idea.'),
    ).toBeVisible()

    const messageInput = appPage.getByPlaceholder('Type your message...')
    await messageInput.fill('I want to build a chat application')

    // Click the Send button (aria-label="Send message")
    await appPage.getByRole('button', { name: 'Send message' }).click()

    // The user message should appear
    await expect(appPage.getByText('I want to build a chat application')).toBeVisible()

    // Input should be cleared
    await expect(messageInput).toHaveValue('')
  })

  test('Send button is disabled when input is empty', async ({
    appPage,
    authedPage,
  }) => {
    await openBrainstormTab(appPage)

    await expect(
      appPage.getByText('Welcome! Let me help you brainstorm your project idea.'),
    ).toBeVisible()

    await expect(
      appPage.getByRole('button', { name: 'Send message' }),
    ).toBeDisabled()
  })

  test('Send button is disabled while waiting for response', async ({
    appPage,
    authedPage,
  }) => {
    // Register a hanging message endpoint that never responds
    await appPage.route(
      `${API_BASE}/projects/${TEST_PROJECT_ID}/brainstorm/${TEST_SESSION_ID}/message`,
      async () => {
        // Intentionally never fulfill — keeps isWaiting true
      },
    )

    await openBrainstormTab(appPage, { skipMessageRoute: true })

    await expect(
      appPage.getByText('Welcome! Let me help you brainstorm your project idea.'),
    ).toBeVisible()

    // Send a message to trigger waiting state
    const messageInput = appPage.getByPlaceholder('Type your message...')
    await messageInput.fill('Test message')
    await appPage.getByRole('button', { name: 'Send message' }).click()

    // "AI is thinking..." should be visible
    await expect(appPage.getByText('AI is thinking...')).toBeVisible()

    // Send button should be disabled while waiting
    await expect(
      appPage.getByRole('button', { name: 'Send message' }),
    ).toBeDisabled()
  })

  test('AI is thinking indicator shows after sending a message', async ({
    appPage,
    authedPage,
  }) => {
    // Hanging message endpoint
    await appPage.route(
      `${API_BASE}/projects/${TEST_PROJECT_ID}/brainstorm/${TEST_SESSION_ID}/message`,
      async () => {
        // Never fulfill
      },
    )

    await openBrainstormTab(appPage, { skipMessageRoute: true })

    await expect(
      appPage.getByText('Welcome! Let me help you brainstorm your project idea.'),
    ).toBeVisible()

    const messageInput = appPage.getByPlaceholder('Type your message...')
    await messageInput.fill('My project idea')
    await messageInput.press('Enter')

    await expect(appPage.getByText('AI is thinking...')).toBeVisible()
  })

  test('quiz card renders from quiz message and allows submission', async ({
    appPage,
    authedPage,
  }) => {
    // Return quiz as the initial message
    await appPage.route(
      `${API_BASE}/projects/${TEST_PROJECT_ID}/brainstorm/start`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            session_id: TEST_SESSION_ID,
            initial_message: QUIZ_MESSAGE,
          }),
        })
      },
    )

    await openBrainstormTab(appPage, { skipStartRoute: true })

    // Quiz question should be visible
    await expect(
      appPage.getByText('What type of application are you building?'),
    ).toBeVisible()

    // Quiz context
    await expect(
      appPage.getByText('This will help determine the best architecture.'),
    ).toBeVisible()

    // Options
    await expect(appPage.getByText('Web Application')).toBeVisible()
    await expect(appPage.getByText('Mobile App')).toBeVisible()
    await expect(appPage.getByText('Desktop App', { exact: true })).toBeVisible()

    // Recommended badge
    await expect(appPage.getByText('Recommended')).toBeVisible()

    // Option description
    await expect(appPage.getByText('A browser-based application')).toBeVisible()

    // Submit Answer button should be disabled initially (no selection)
    await expect(
      appPage.getByRole('button', { name: 'Submit Answer' }),
    ).toBeDisabled()

    // Select an option
    await appPage.getByText('Web Application').click()

    // Submit Answer button should now be enabled
    await expect(
      appPage.getByRole('button', { name: 'Submit Answer' }),
    ).toBeEnabled()

    // Submit the answer
    await appPage.getByRole('button', { name: 'Submit Answer' }).click()

    // "Answer submitted" confirmation should appear
    await expect(appPage.getByText('Answer submitted')).toBeVisible()

    // Submit Answer button should disappear after submission
    await expect(
      appPage.getByRole('button', { name: 'Submit Answer' }),
    ).not.toBeVisible()
  })

  test('quiz card allows custom text input when allow_custom is true', async ({
    appPage,
    authedPage,
  }) => {
    await appPage.route(
      `${API_BASE}/projects/${TEST_PROJECT_ID}/brainstorm/start`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            session_id: TEST_SESSION_ID,
            initial_message: QUIZ_MESSAGE,
          }),
        })
      },
    )

    await openBrainstormTab(appPage, { skipStartRoute: true })

    // Custom input should be visible
    const customInput = appPage.getByPlaceholder('Or type your own answer...')
    await expect(customInput).toBeVisible()

    // Type a custom answer
    await customInput.fill('CLI tool')

    // Submit button should be enabled (custom text counts)
    await expect(
      appPage.getByRole('button', { name: 'Submit Answer' }),
    ).toBeEnabled()

    // Submit
    await appPage.getByRole('button', { name: 'Submit Answer' }).click()

    // Submitted confirmation
    await expect(appPage.getByText('Answer submitted')).toBeVisible()
  })

  test('summary message renders with Summary Ready card and Review & Edit button', async ({
    appPage,
    authedPage,
  }) => {
    await appPage.route(
      `${API_BASE}/projects/${TEST_PROJECT_ID}/brainstorm/start`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            session_id: TEST_SESSION_ID,
            initial_message: SUMMARY_MESSAGE,
          }),
        })
      },
    )

    await openBrainstormTab(appPage, { skipStartRoute: true })

    // Summary Ready heading should be visible
    await expect(appPage.getByText('Summary Ready')).toBeVisible()

    // Summary content should be visible
    await expect(
      appPage.getByText(
        'Here is a summary of the brainstorm session with key outcomes.',
      ),
    ).toBeVisible()

    // Review & Edit button should be visible
    await expect(
      appPage.getByRole('button', { name: 'Review & Edit' }),
    ).toBeVisible()
  })

  test('clicking Review & Edit transitions to review phase', async ({
    appPage,
    authedPage,
  }) => {
    await appPage.route(
      `${API_BASE}/projects/${TEST_PROJECT_ID}/brainstorm/start`,
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            session_id: TEST_SESSION_ID,
            initial_message: SUMMARY_MESSAGE,
          }),
        })
      },
    )

    await openBrainstormTab(appPage, { skipStartRoute: true })

    // Wait for summary to appear
    await expect(appPage.getByText('Summary Ready')).toBeVisible()

    // Click Review & Edit
    await appPage.getByRole('button', { name: 'Review & Edit' }).click()

    // Should transition to the review phase (BrainstormReview component)
    await expect(
      appPage.getByRole('heading', { name: 'Review Brainstorm Output' }),
    ).toBeVisible()

    // The Create Ticket button should be visible on the review screen
    await expect(
      appPage.getByRole('button', { name: 'Create Ticket' }),
    ).toBeVisible()
  })

  test('input placeholder is visible', async ({ appPage, authedPage }) => {
    await openBrainstormTab(appPage)

    await expect(
      appPage.getByText('Welcome! Let me help you brainstorm your project idea.'),
    ).toBeVisible()

    await expect(
      appPage.getByPlaceholder('Type your message...'),
    ).toBeVisible()
  })

  test('pressing Enter on empty input does not send a message', async ({
    appPage,
    authedPage,
  }) => {
    await openBrainstormTab(appPage)

    await expect(
      appPage.getByText('Welcome! Let me help you brainstorm your project idea.'),
    ).toBeVisible()

    const messageInput = appPage.getByPlaceholder('Type your message...')

    // Press Enter on empty input
    await messageInput.press('Enter')

    // "AI is thinking..." should NOT appear (no message was sent)
    await expect(appPage.getByText('AI is thinking...')).not.toBeVisible()

    // Only the initial message should be present
    const chatBubbles = appPage.locator('[data-slot="chat-bubble"]')
    await expect(chatBubbles).toHaveCount(1)
  })

  test('whitespace-only input does not send a message', async ({
    appPage,
    authedPage,
  }) => {
    await openBrainstormTab(appPage)

    await expect(
      appPage.getByText('Welcome! Let me help you brainstorm your project idea.'),
    ).toBeVisible()

    const messageInput = appPage.getByPlaceholder('Type your message...')
    await messageInput.fill('   ')

    // Send button should be disabled for whitespace-only input
    await expect(
      appPage.getByRole('button', { name: 'Send message' }),
    ).toBeDisabled()

    // Press Enter should not send
    await messageInput.press('Enter')

    // No waiting indicator
    await expect(appPage.getByText('AI is thinking...')).not.toBeVisible()
  })

  test('multiple user messages display in order', async ({
    appPage,
    authedPage,
  }) => {
    await openBrainstormTab(appPage)

    await expect(
      appPage.getByText('Welcome! Let me help you brainstorm your project idea.'),
    ).toBeVisible()

    // Send first message
    const messageInput = appPage.getByPlaceholder('Type your message...')
    await messageInput.fill('First message from user')
    await messageInput.press('Enter')

    // User message should appear
    await expect(appPage.getByText('First message from user')).toBeVisible()

    // The initial assistant message should still be the first chat bubble
    const chatBubbles = appPage.locator('[data-slot="chat-bubble"]')
    await expect(chatBubbles.first()).toContainText(
      'Welcome! Let me help you brainstorm your project idea.',
    )
  })
})
