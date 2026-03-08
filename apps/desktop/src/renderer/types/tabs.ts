export type TabType = 'home' | 'ticket' | 'settings'

export interface HomeTab {
  id: 'home'
  type: 'home'
  label: 'Home'
}

export interface TicketTab {
  id: string
  type: 'ticket'
  ticketId: string
  projectId: string
  label: string
}

export interface SettingsTab {
  id: string
  type: 'settings'
  projectId: string
  label: 'Settings'
}

export type AppTab = HomeTab | TicketTab | SettingsTab
