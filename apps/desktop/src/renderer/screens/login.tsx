import { useState } from 'react'
import { Workflow } from 'lucide-react'
import { Button, Input, Label } from '@agent-coding/ui'
import { apiClient, ApiError } from 'renderer/lib/api-client'
import { useAuthStore } from 'renderer/stores/use-auth-store'
import type { TokenResponse } from 'renderer/types/api'

export function LoginScreen() {
  const { setAuth } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await apiClient<TokenResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setAuth(res.access_token, res.user)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
      } else {
        setError('Something went wrong')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex h-screen">
      <div className="absolute top-0 left-0 right-0 h-9 app-drag" />
      {/* Left — Branding */}
      <div className="hidden w-1/2 flex-col items-center justify-center gap-4 bg-gradient-to-br from-[#0A84FF] to-[#0055CC] lg:flex">
        <Workflow className="size-16 text-white" strokeWidth={1.5} />
        <h1 className="text-2xl font-semibold text-white">Agent Coding</h1>
        <p className="text-sm text-white/70">Workflow Manager for Claude Code</p>
      </div>

      {/* Right — Form */}
      <div className="flex flex-1 items-center justify-center bg-background">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-6 px-8">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to continue
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  )
}
