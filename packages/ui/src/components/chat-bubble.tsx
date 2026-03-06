import * as React from 'react'

import { cn } from '@/lib/utils'

interface ChatBubbleProps extends React.ComponentProps<'div'> {
  role: 'user' | 'assistant' | 'system'
  children: React.ReactNode
  timestamp?: string
}

function ChatBubble({
  className,
  role,
  children,
  timestamp,
  ...props
}: ChatBubbleProps) {
  return (
    <div
      className={cn(
        'flex w-full gap-3',
        role === 'user' ? 'justify-end' : 'justify-start',
        className
      )}
      data-slot="chat-bubble"
      data-role={role}
      {...props}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed',
          role === 'user' && 'bg-primary/10 text-foreground',
          role === 'assistant' && 'bg-card text-foreground border border-border',
          role === 'system' && 'bg-destructive/10 text-destructive text-[12px] italic'
        )}
      >
        {children}
        {timestamp && (
          <div className="mt-1 text-right text-[10px] text-muted-foreground">
            {timestamp}
          </div>
        )}
      </div>
    </div>
  )
}

export { ChatBubble }
export type { ChatBubbleProps }
