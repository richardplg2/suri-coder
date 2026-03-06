# State Management Design

## Decision

Use **Zustand** for UI state and **TanStack Query** for server state.

## Dependencies

- `zustand` (^5.0) - UI state management
- `@tanstack/react-query` (^5.0) - Server state management

## Architecture

```
apps/desktop/src/renderer/
├── stores/                    # Zustand UI stores
│   ├── use-sidebar-store.ts
│   ├── use-theme-store.ts
│   └── use-modal-store.ts
├── hooks/
│   └── queries/               # TanStack Query hooks
│       ├── use-projects.ts
│       ├── use-tickets.ts
│       └── use-workflows.ts
├── lib/
│   ├── api-client.ts          # Fetch wrapper for FastAPI
│   └── query-client.ts        # QueryClient config
```

## Zustand Stores (UI State)

Each store is small, scoped to a single feature. State + actions in one slice.

```ts
// Example: stores/use-sidebar-store.ts
import { create } from 'zustand'

interface SidebarStore {
  isOpen: boolean
  activeNav: string
  toggle: () => void
  setActiveNav: (nav: string) => void
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  isOpen: true,
  activeNav: 'projects',
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setActiveNav: (nav) => set({ activeNav: nav }),
}))
```

**Conventions:**
- One store per feature, not one giant store
- Use `zustand/middleware` persist for state that survives restart (theme, sidebar)
- No server data in Zustand stores

## TanStack Query (Server State)

### API Client

```ts
// lib/api-client.ts
const API_BASE = 'http://localhost:8000/api/v1'

export async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}
```

### Query Hooks

```ts
// hooks/queries/use-projects.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient<Project[]>('/projects'),
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: () => apiClient<Project>(`/projects/${id}`),
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateProject) =>
      apiClient<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}
```

**Conventions:**
- Query key: `[resource]` for list, `[resource, id]` for detail
- Mutations invalidate related queries on success
- QueryClient defaults: `staleTime: 30s`, `retry: 1`

## Provider Setup

```tsx
// renderer/index.tsx
<QueryClientProvider client={queryClient}>
  <AppRoutes />
</QueryClientProvider>
```

Zustand needs no provider — import stores directly.

## Error/Loading Handling

Handle at component level using TanStack Query status:

```tsx
function ProjectList() {
  const { data: projects, isLoading, error } = useProjects()
  if (isLoading) return <Spinner />
  if (error) return <ErrorAlert message={error.message} />
  return <ProjectTable projects={projects} />
}
```
