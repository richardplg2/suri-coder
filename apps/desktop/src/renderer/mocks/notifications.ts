import type { Notification } from 'renderer/types/api'

const now = new Date()
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000).toISOString()
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString()

export const mockNotifications: Notification[] = [
  {
    id: 'n1',
    user_id: 'u1',
    type: 'step_completed',
    title: 'Build step completed',
    body: "Project 'Workflow Manager' — build passed all checks",
    resource_type: 'step',
    resource_id: 's1',
    read: false,
    created_at: hoursAgo(0.03), // ~2 minutes ago
  },
  {
    id: 'n2',
    user_id: 'u1',
    type: 'step_awaiting_approval',
    title: 'Approval required',
    body: 'Deploy to production needs your review',
    resource_type: 'step',
    resource_id: 's2',
    read: false,
    created_at: hoursAgo(1),
  },
  {
    id: 'n3',
    user_id: 'u1',
    type: 'step_failed',
    title: 'Test step failed',
    body: 'Integration tests failed with 3 errors',
    resource_type: 'step',
    resource_id: 's3',
    read: false,
    created_at: hoursAgo(3),
  },
  {
    id: 'n4',
    user_id: 'u1',
    type: 'workflow_completed',
    title: 'Workflow completed',
    body: 'Login Flow workflow finished successfully',
    resource_type: 'workflow',
    resource_id: 'w1',
    read: true,
    created_at: daysAgo(1), // yesterday
  },
  {
    id: 'n5',
    user_id: 'u1',
    type: 'review_requested',
    title: 'Code review requested',
    body: 'PR #42 needs your review — auth middleware changes',
    resource_type: 'workflow',
    resource_id: 'w2',
    read: true,
    created_at: daysAgo(1),
  },
  {
    id: 'n6',
    user_id: 'u1',
    type: 'workflow_completed',
    title: 'Workflow completed',
    body: 'Dashboard redesign passed all steps',
    resource_type: 'workflow',
    resource_id: 'w3',
    read: true,
    created_at: daysAgo(3),
  },
]
