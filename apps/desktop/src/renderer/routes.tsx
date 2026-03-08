import { Route } from 'react-router-dom'

import { Router } from 'lib/electron-router-dom'
import { AppLayout } from './components/app-layout'
import { ErrorBoundary, RouteErrorFallback } from './components/error-boundary'
import { TabContent } from './components/tab-content'
import { ModalProvider } from './components/modals'
import { LoginScreen } from './screens/login'
import { useAuthStore } from './stores/use-auth-store'

function AppShell() {
  return (
    <AppLayout>
      <TabContent />
      <ModalProvider />
    </AppLayout>
  )
}

function Root() {
  const token = useAuthStore((s) => s.token)
  return token ? <AppShell /> : <LoginScreen />
}

export function AppRoutes() {
  return (
    <Router
      main={
        <Route
          element={
            <ErrorBoundary>
              <Root />
            </ErrorBoundary>
          }
          path="/"
          errorElement={<RouteErrorFallback />}
        />
      }
    />
  )
}
