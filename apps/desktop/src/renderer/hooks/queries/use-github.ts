import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { apiClient } from 'renderer/lib/api-client'
import type {
  GitHubAccount,
  GitHubRepoItem,
  ProjectRepository,
  ConnectReposRequest,
} from 'renderer/types/api'

// --- GitHub Accounts ---

export function useGitHubAccounts() {
  return useQuery({
    queryKey: ['github-accounts'],
    queryFn: () => apiClient<GitHubAccount[]>('/users/me/github-accounts'),
  })
}

export function useDeleteGitHubAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (accountId: string) =>
      apiClient<void>(`/users/me/github-accounts/${accountId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['github-accounts'] }),
  })
}

// --- GitHub Repo Browsing ---

export function useGitHubRepos(accountId: string, page = 1, perPage = 30) {
  return useQuery({
    queryKey: ['github-accounts', accountId, 'repos', { page, perPage }],
    queryFn: () =>
      apiClient<GitHubRepoItem[]>(
        `/users/me/github-accounts/${accountId}/repos?page=${page}&per_page=${perPage}`
      ),
    enabled: !!accountId,
  })
}

export function useSearchGitHubRepos(accountId: string, query: string) {
  return useQuery({
    queryKey: ['github-accounts', accountId, 'repos', 'search', query],
    queryFn: () =>
      apiClient<GitHubRepoItem[]>(
        `/users/me/github-accounts/${accountId}/repos/search?q=${encodeURIComponent(query)}`
      ),
    enabled: !!accountId && query.length > 0,
  })
}

// --- Project Repositories ---

export function useProjectRepositories(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId, 'repositories'],
    queryFn: () =>
      apiClient<ProjectRepository[]>(`/projects/${projectId}/repositories`),
    enabled: !!projectId,
  })
}

export function useConnectRepos(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ConnectReposRequest) =>
      apiClient<ProjectRepository[]>(`/projects/${projectId}/repositories`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'repositories'] })
      qc.invalidateQueries({ queryKey: ['projects', projectId] })
    },
  })
}

export function useDisconnectRepo(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (repoId: string) =>
      apiClient<void>(`/projects/${projectId}/repositories/${repoId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'repositories'] })
      qc.invalidateQueries({ queryKey: ['projects', projectId] })
    },
  })
}
