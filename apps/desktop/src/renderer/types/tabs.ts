export type TabType = 'home' | 'project' | 'ticket'

export interface HomeTab {
  id: 'home'
  type: 'home'
  label: 'Home'
  pinned: true
}

export interface ProjectTab {
  id: string
  type: 'project'
  projectId: string
  label: string
  pinned: true
}

export interface TicketTab {
  id: string
  type: 'ticket'
  ticketId: string
  projectId: string
  label: string
  pinned: false
}

export type AppTab = HomeTab | ProjectTab | TicketTab
