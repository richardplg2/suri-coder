# State Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Zustand (UI state) and TanStack Query (server state) to the Electron desktop app.

**Architecture:** Zustand stores for UI state (sidebar, theme, modals), TanStack Query for API data from FastAPI backend. Thin fetch wrapper as API client. QueryClientProvider wraps the app; Zustand stores are imported directly.

**Tech Stack:** zustand ^5.0, @tanstack/react-query ^5.0, React 19, TypeScript

**Design doc:** `docs/plans/2026-03-07-state-management-design.md`

---

### Task 1: Install Dependencies

**Files:**
- Modify: `apps/desktop/package.json`

**Step 1: Install zustand and @tanstack/react-query**

Run:
```bash
cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app add zustand @tanstack/react-query
```

**Step 2: Verify installation**

Run:
```bash
cd /home/richard/work/AgentCoding/agent-coding/apps/desktop && cat package.json | grep -E "zustand|react-query"
```
Expected: Both packages listed in dependencies.

**Step 3: Commit**

```bash
git add apps/desktop/package.json pnpm-lock.yaml
git commit -m "feat(desktop): add zustand and tanstack-query dependencies"
```

---

### Task 2: API Client

**Files:**
- Create: `apps/desktop/src/renderer/lib/api-client.ts`

**Step 1: Create the API client**

```ts
// apps/desktop/src/renderer/lib/api-client.ts
const API_BASE = 'http://localhost:8000/api/v1'

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiClient<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })

  if (!res.ok) {
    throw new ApiError(res.status, `API error: ${res.status}`)
  }

  return res.json()
}
```

**Step 2: Verify typecheck passes**

Run:
```bash
cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app typecheck
```
Expected: No errors.

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/lib/api-client.ts
git commit -m "feat(desktop): add API client for FastAPI backend"
```

---

### Task 3: QueryClient Configuration + Provider Setup

**Files:**
- Create: `apps/desktop/src/renderer/lib/query-client.ts`
- Modify: `apps/desktop/src/renderer/index.tsx`

**Step 1: Create QueryClient config**

```ts
// apps/desktop/src/renderer/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
})
```

**Step 2: Wrap app with QueryClientProvider**

Modify `apps/desktop/src/renderer/index.tsx` to:

```tsx
import ReactDom from 'react-dom/client'
import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'

import { queryClient } from './lib/query-client'
import { AppRoutes } from './routes'

import './globals.css'

ReactDom.createRoot(document.querySelector('app') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  </React.StrictMode>,
)
```

**Step 3: Verify typecheck passes**

Run:
```bash
cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app typecheck
```
Expected: No errors.

**Step 4: Commit**

```bash
git add apps/desktop/src/renderer/lib/query-client.ts apps/desktop/src/renderer/index.tsx
git commit -m "feat(desktop): add QueryClient config and provider setup"
```

---

### Task 4: TypeScript Types for API Responses

**Files:**
- Create: `apps/desktop/src/renderer/types/api.ts`

**Step 1: Create shared API types matching backend schemas**

These types mirror the backend Pydantic schemas at `apps/backend/app/schemas/`.

```ts
// apps/desktop/src/renderer/types/api.ts

export interface Project {
  id: string
  name: string
  slug: string
  path: string
  repo_url: string | null
  description: string | null
  settings: Record<string, unknown> | null
  created_by: string
  created_at: string
  member_count: number
}

export interface ProjectCreate {
  name: string
  slug: string
  path: string
  repo_url?: string | null
  description?: string | null
  settings?: Record<string, unknown> | null
}

export interface ProjectUpdate {
  name?: string | null
  description?: string | null
  path?: string | null
  repo_url?: string | null
  settings?: Record<string, unknown> | null
}

export type TicketType = 'feature' | 'bug' | 'chore' | 'spike'
export type TicketStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done'
export type TicketPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent'
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

export interface WorkflowStep {
  id: string
  template_step_id: string
  name: string
  description: string | null
  agent_config_id: string | null
  status: StepStatus
  order: number
}

export interface Ticket {
  id: string
  project_id: string
  key: string
  title: string
  description: string | null
  type: TicketType
  status: TicketStatus
  priority: TicketPriority
  template_id: string | null
  assignee_id: string | null
  budget_usd: number | null
  created_by: string
  created_at: string
  steps: WorkflowStep[]
}

export interface TicketListItem {
  id: string
  project_id: string
  key: string
  title: string
  type: TicketType
  status: TicketStatus
  priority: TicketPriority
  assignee_id: string | null
  created_at: string
}

export interface TicketCreate {
  title: string
  description?: string | null
  type?: TicketType
  priority?: TicketPriority
  template_id?: string | null
  assignee_id?: string | null
  budget_usd?: number | null
}

export interface TicketUpdate {
  title?: string | null
  description?: string | null
  type?: TicketType | null
  status?: TicketStatus | null
  priority?: TicketPriority | null
  assignee_id?: string | null
  budget_usd?: number | null
}

export interface WorkflowTemplate {
  id: string
  project_id: string | null
  name: string
  description: string | null
  steps_config: Record<string, unknown>
  created_at: string
}
```

**Step 2: Verify typecheck passes**

Run:
```bash
cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app typecheck
```
Expected: No errors.

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/types/api.ts
git commit -m "feat(desktop): add TypeScript types mirroring backend API schemas"
```

---

### Task 5: TanStack Query Hooks — Projects

**Files:**
- Create: `apps/desktop/src/renderer/hooks/queries/use-projects.ts`

**Step 1: Create project query hooks**

```ts
// apps/desktop/src/renderer/hooks/queries/use-projects.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { apiClient } from 'renderer/lib/api-client'
import type { Project, ProjectCreate, ProjectUpdate } from 'renderer/types/api'

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
    enabled: !!id,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ProjectCreate) =>
      apiClient<Project>('/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}

export function useUpdateProject(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ProjectUpdate) =>
      apiClient<Project>(`/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: ['projects', id] })
    },
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<void>(`/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}
```

**Step 2: Verify typecheck passes**

Run:
```bash
cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app typecheck
```
Expected: No errors.

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/hooks/queries/use-projects.ts
git commit -m "feat(desktop): add TanStack Query hooks for projects API"
```

---

### Task 6: TanStack Query Hooks — Tickets

**Files:**
- Create: `apps/desktop/src/renderer/hooks/queries/use-tickets.ts`

**Step 1: Create ticket query hooks**

```ts
// apps/desktop/src/renderer/hooks/queries/use-tickets.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { apiClient } from 'renderer/lib/api-client'
import type {
  Ticket,
  TicketListItem,
  TicketCreate,
  TicketUpdate,
} from 'renderer/types/api'

export function useTickets(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'tickets'],
    queryFn: () =>
      apiClient<TicketListItem[]>(`/projects/${projectId}/tickets`),
    enabled: !!projectId,
  })
}

export function useTicket(projectId: string, ticketId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'tickets', ticketId],
    queryFn: () =>
      apiClient<Ticket>(`/projects/${projectId}/tickets/${ticketId}`),
    enabled: !!projectId && !!ticketId,
  })
}

export function useCreateTicket(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TicketCreate) =>
      apiClient<Ticket>(`/projects/${projectId}/tickets`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets'] }),
  })
}

export function useUpdateTicket(projectId: string, ticketId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TicketUpdate) =>
      apiClient<Ticket>(`/projects/${projectId}/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tickets'] })
      qc.invalidateQueries({
        queryKey: ['projects', projectId, 'tickets', ticketId],
      })
    },
  })
}
```

**Step 2: Verify typecheck passes**

Run:
```bash
cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app typecheck
```
Expected: No errors.

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/hooks/queries/use-tickets.ts
git commit -m "feat(desktop): add TanStack Query hooks for tickets API"
```

---

### Task 7: TanStack Query Hooks — Workflow Templates

**Files:**
- Create: `apps/desktop/src/renderer/hooks/queries/use-workflows.ts`

**Step 1: Create workflow template query hooks**

```ts
// apps/desktop/src/renderer/hooks/queries/use-workflows.ts
import { useQuery } from '@tanstack/react-query'

import { apiClient } from 'renderer/lib/api-client'
import type { WorkflowTemplate } from 'renderer/types/api'

export function useWorkflowTemplates(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'templates'],
    queryFn: () =>
      apiClient<WorkflowTemplate[]>(`/projects/${projectId}/templates`),
    enabled: !!projectId,
  })
}

export function useWorkflowTemplate(projectId: string, templateId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'templates', templateId],
    queryFn: () =>
      apiClient<WorkflowTemplate>(
        `/projects/${projectId}/templates/${templateId}`,
      ),
    enabled: !!projectId && !!templateId,
  })
}
```

**Step 2: Verify typecheck passes**

Run:
```bash
cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app typecheck
```
Expected: No errors.

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/hooks/queries/use-workflows.ts
git commit -m "feat(desktop): add TanStack Query hooks for workflow templates API"
```

---

### Task 8: Zustand Store — Sidebar

**Files:**
- Create: `apps/desktop/src/renderer/stores/use-sidebar-store.ts`

**Step 1: Create sidebar store with persist**

```ts
// apps/desktop/src/renderer/stores/use-sidebar-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarStore {
  isOpen: boolean
  activeNav: string
  toggle: () => void
  setActiveNav: (nav: string) => void
}

export const useSidebarStore = create<SidebarStore>()(
  persist(
    (set) => ({
      isOpen: true,
      activeNav: 'projects',
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      setActiveNav: (nav) => set({ activeNav: nav }),
    }),
    { name: 'sidebar-store' },
  ),
)
```

**Step 2: Verify typecheck passes**

Run:
```bash
cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app typecheck
```
Expected: No errors.

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/stores/use-sidebar-store.ts
git commit -m "feat(desktop): add Zustand sidebar store with persistence"
```

---

### Task 9: Zustand Store — Theme

**Files:**
- Create: `apps/desktop/src/renderer/stores/use-theme-store.ts`

**Step 1: Create theme store with persist**

```ts
// apps/desktop/src/renderer/stores/use-theme-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface ThemeStore {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'theme-store' },
  ),
)
```

**Step 2: Verify typecheck passes**

Run:
```bash
cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app typecheck
```
Expected: No errors.

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/stores/use-theme-store.ts
git commit -m "feat(desktop): add Zustand theme store with persistence"
```

---

### Task 10: Zustand Store — Modal

**Files:**
- Create: `apps/desktop/src/renderer/stores/use-modal-store.ts`

**Step 1: Create modal store**

```ts
// apps/desktop/src/renderer/stores/use-modal-store.ts
import { create } from 'zustand'

interface ModalStore {
  activeModal: string | null
  modalData: Record<string, unknown> | null
  open: (modal: string, data?: Record<string, unknown>) => void
  close: () => void
}

export const useModalStore = create<ModalStore>((set) => ({
  activeModal: null,
  modalData: null,
  open: (modal, data = null) => set({ activeModal: modal, modalData: data }),
  close: () => set({ activeModal: null, modalData: null }),
}))
```

**Step 2: Verify typecheck passes**

Run:
```bash
cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app typecheck
```
Expected: No errors.

**Step 3: Commit**

```bash
git add apps/desktop/src/renderer/stores/use-modal-store.ts
git commit -m "feat(desktop): add Zustand modal store"
```

---

### Task 11: Final Verification

**Step 1: Run full typecheck**

Run:
```bash
cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app typecheck
```
Expected: No errors.

**Step 2: Run lint**

Run:
```bash
cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app lint
```
Expected: No errors (or auto-fixable only).

**Step 3: Verify dev server starts**

Run:
```bash
cd /home/richard/work/AgentCoding/agent-coding && pnpm --filter my-electron-app dev
```
Expected: App starts without errors. Quit after confirming.
