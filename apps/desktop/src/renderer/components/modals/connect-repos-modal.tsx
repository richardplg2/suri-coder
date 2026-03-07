import { useState } from 'react'
import { GitBranch, Lock, Globe, Search, Check } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
  Button, Input, Spinner, ScrollArea,
} from '@agent-coding/ui'
import { useModalStore } from 'renderer/stores/use-modal-store'
import {
  useGitHubAccounts,
  useGitHubRepos,
  useSearchGitHubRepos,
  useConnectRepos,
} from 'renderer/hooks/queries/use-github'
import type { GitHubRepoItem } from 'renderer/types/api'

export function ConnectReposModal() {
  const { activeModal, modalData, close } = useModalStore()
  const isOpen = activeModal === 'connect-repos'
  const projectId = (modalData?.projectId as string) ?? ''

  const [selectedAccountId, setSelectedAccountId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedRepos, setSelectedRepos] = useState<GitHubRepoItem[]>([])
  const [error, setError] = useState<string | null>(null)

  const { data: accounts, isLoading: accountsLoading } = useGitHubAccounts()
  const { data: repos, isLoading: reposLoading } = useGitHubRepos(selectedAccountId)
  const { data: searchResults, isLoading: searchLoading } = useSearchGitHubRepos(
    selectedAccountId,
    searchQuery
  )
  const connectRepos = useConnectRepos(projectId)

  const displayedRepos = searchQuery.length > 0 ? searchResults : repos
  const isLoadingRepos = searchQuery.length > 0 ? searchLoading : reposLoading

  function toggleRepo(repo: GitHubRepoItem) {
    setSelectedRepos((prev) => {
      const exists = prev.some((r) => r.github_repo_id === repo.github_repo_id)
      if (exists) return prev.filter((r) => r.github_repo_id !== repo.github_repo_id)
      return [...prev, repo]
    })
  }

  function isSelected(repo: GitHubRepoItem) {
    return selectedRepos.some((r) => r.github_repo_id === repo.github_repo_id)
  }

  async function handleConnect() {
    if (!selectedAccountId || selectedRepos.length === 0) return
    setError(null)
    try {
      await connectRepos.mutateAsync({
        github_account_id: selectedAccountId,
        repos: selectedRepos,
      })
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect repositories')
    }
  }

  function handleClose() {
    close()
    setSelectedAccountId('')
    setSearchQuery('')
    setSelectedRepos([])
    setError(null)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect Repositories</DialogTitle>
          <DialogDescription>Select repositories to connect to this project.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Account selector */}
          {accountsLoading ? (
            <Spinner label="Loading accounts..." />
          ) : !accounts || accounts.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              No GitHub accounts linked. Go to Settings to connect one.
            </p>
          ) : (
            <div className="space-y-1.5">
              <label className="text-label">GitHub Account</label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-[13px]"
                value={selectedAccountId}
                onChange={(e) => {
                  setSelectedAccountId(e.target.value)
                  setSearchQuery('')
                  setSelectedRepos([])
                }}
              >
                <option value="">Select an account...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.username} {a.display_name ? `(${a.display_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search + repo list */}
          {selectedAccountId && (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search repositories..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <ScrollArea className="h-[300px] rounded-md border">
                {isLoadingRepos ? (
                  <div className="flex h-full items-center justify-center">
                    <Spinner label="Loading repos..." />
                  </div>
                ) : !displayedRepos || displayedRepos.length === 0 ? (
                  <p className="p-4 text-[13px] text-muted-foreground">No repositories found.</p>
                ) : (
                  <div className="divide-y">
                    {displayedRepos.map((repo) => (
                      <button
                        key={repo.github_repo_id}
                        type="button"
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary/50 ${
                          isSelected(repo) ? 'bg-primary/5' : ''
                        }`}
                        onClick={() => toggleRepo(repo)}
                      >
                        <div className="flex size-5 items-center justify-center rounded border">
                          {isSelected(repo) && <Check className="size-3.5 text-primary" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <GitBranch className="size-3.5 text-muted-foreground" />
                            <span className="text-[13px] font-medium truncate">
                              {repo.full_name}
                            </span>
                            {repo.is_private ? (
                              <Lock className="size-3 text-muted-foreground" />
                            ) : (
                              <Globe className="size-3 text-muted-foreground" />
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-caption text-muted-foreground truncate mt-0.5">
                              {repo.description}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {selectedRepos.length > 0 && (
                <p className="text-[13px] text-muted-foreground">
                  {selectedRepos.length} repositor{selectedRepos.length === 1 ? 'y' : 'ies'} selected
                </p>
              )}
            </>
          )}

          {error && <p className="text-[13px] text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={selectedRepos.length === 0 || connectRepos.isPending}
          >
            {connectRepos.isPending ? 'Connecting...' : `Connect (${selectedRepos.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
