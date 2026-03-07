import { Route } from 'react-router-dom'

import { Router } from 'lib/electron-router-dom'
import { AppLayout } from './components/app-layout'
import { TabContent } from './components/tab-content'

function AppShell() {
  return (
    <AppLayout>
      <TabContent />
    </AppLayout>
  )
}

export function AppRoutes() {
  return <Router main={<Route element={<AppShell />} path="/" />} />
}
