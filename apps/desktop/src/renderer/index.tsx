import ReactDom from 'react-dom/client'
import React, { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'

import { queryClient } from './lib/query-client'
import { AppRoutes } from './routes'
import { useThemeStore } from './stores/use-theme-store'

import './globals.css'

function ThemeSync() {
  const theme = useThemeStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', prefersDark)
    } else {
      root.classList.toggle('dark', theme === 'dark')
    }
  }, [theme])

  return null
}

ReactDom.createRoot(document.querySelector('app') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeSync />
      <AppRoutes />
    </QueryClientProvider>
  </React.StrictMode>,
)
