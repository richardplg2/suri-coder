import { useState } from 'react'
import { Github, Trash2 } from 'lucide-react'
import { Button, ScrollArea, Spinner, EmptyState } from '@agent-coding/ui'
import { useGitHubAccounts, useDeleteGitHubAccount } from 'renderer/hooks/queries/use-github'
import { apiClient } from 'renderer/lib/api-client'

export function GitHubAccounts() {
  const { data: accounts, isLoading } = useGitHubAccounts()
  const deleteAccount = useDeleteGitHubAccount()
  const [connecting, setConnecting] = useState(false)

  async function handleConnect() {
    setConnecting(true)
    try {
      const data = await apiClient<{ authorize_url: string }>('/auth/github/authorize')
      window.open(data.authorize_url, '_blank')
    } catch {
      // ignore
    } finally {
      setConnecting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading GitHub accounts..." />
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-lg p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">GitHub Accounts</h2>
          <Button size="sm" onClick={handleConnect} disabled={connecting}>
            <Github className="mr-1.5 size-4" />
            {connecting ? 'Opening...' : 'Connect Account'}
          </Button>
        </div>

        {!accounts || accounts.length === 0 ? (
          <EmptyState
            icon={Github}
            title="No GitHub accounts connected"
            description="Connect a GitHub account to browse and link repositories to your projects."
            action={
              <Button size="sm" onClick={handleConnect}>
                Connect GitHub Account
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  {account.avatar_url ? (
                    <img
                      src={account.avatar_url}
                      alt={account.username}
                      className="size-8 rounded-full"
                    />
                  ) : (
                    <Github className="size-8 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-[13px] font-medium">{account.username}</p>
                    {account.display_name && (
                      <p className="text-caption text-muted-foreground">{account.display_name}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => deleteAccount.mutate(account.id)}
                  disabled={deleteAccount.isPending}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
