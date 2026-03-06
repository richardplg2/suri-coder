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
