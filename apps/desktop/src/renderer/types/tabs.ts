export type TabType = 'home' | 'ticket' | 'settings' | 'figma' | 'brainstorm'

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

export interface FigmaTab {
  id: string
  type: 'figma'
  projectId: string
  label: string
}

export interface BrainstormTab {
  id: string
  type: 'brainstorm'
  projectId: string
  brainstormId: string
  label: string
}

export type AppTab = HomeTab | TicketTab | SettingsTab | FigmaTab | BrainstormTab
