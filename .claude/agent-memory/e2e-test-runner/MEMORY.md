# E2E Test Runner Memory

## Key Patterns

### Navigating to Non-Standard Tabs (brainstorm, figma-import)
- Inject both `auth-store` AND `tab-store` into localStorage, then reload
- Must re-inject auth-store before reload since the auth fixture's reload happens first
- The `tabToBarTab()` in `app-layout.tsx` must handle all tab types or the app crashes
- See `openBrainstormTab()` helper in `e2e/flows/brainstorm.spec.ts` for the pattern

### Route Mock Ordering
- Register custom route overrides BEFORE calling the navigation helper
- Use `skipStartRoute`/`skipMessageRoute` style flags to prevent double-registration
- Routes registered via `page.route()` persist across page reloads

### Selector Gotchas
- `getByText('Desktop App')` can match substring in descriptions like "A desktop application..."
- Use `{ exact: true }` when text may appear as substring in sibling elements
- Quiz option buttons contain both label and description text, so `getByText` can be ambiguous

### Hanging Requests for Loading States
- To test "waiting" / "AI is thinking..." states, register a route handler that never calls `route.fulfill()`
- The pending request is cleaned up automatically when the page navigates away or test ends

### Bug Found: app-layout.tsx tabToBarTab
- Was missing `brainstorm` and `figma-import` cases, causing crash when those tabs were active
- Fixed by adding cases that return `{ id, label, closable: true }`

## File Locations
- Desktop E2E tests: `apps/desktop/e2e/`
- Fixtures: `apps/desktop/e2e/fixtures/`
- Brainstorm screen: `apps/desktop/src/renderer/screens/brainstorm.tsx`
- Tab types: `apps/desktop/src/renderer/types/tabs.ts`
- WS types: `packages/shared/src/types/websocket.ts`
- API types: `apps/desktop/src/renderer/types/api.ts`

## WebSocket Testing Limitation
- Cannot easily test WebSocket events in E2E mock tests
- The Zustand ws store (`use-ws-store.ts`) is not persisted and not accessible from `page.evaluate()`
- Workaround: test WebSocket-driven features via initial_message mock (return quiz/summary as initial message)
- Full WebSocket testing would require either exposing store on window or integration tests with real backend
