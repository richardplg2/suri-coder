import * as React from 'react'

import { cn } from '@/lib/utils'

interface StreamingTextProps extends React.ComponentProps<'div'> {
  content: string
  isStreaming?: boolean
}

function StreamingText({
  className,
  content,
  isStreaming = false,
  ...props
}: StreamingTextProps) {
  return (
    <div
      className={cn('text-[13px] leading-relaxed text-foreground', className)}
      data-slot="streaming-text"
      {...props}
    >
      <span className="whitespace-pre-wrap">{content}</span>
      {isStreaming && (
        <span
          className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-primary align-text-bottom"
          aria-hidden
        />
      )}
    </div>
  )
}

export { StreamingText }
export type { StreamingTextProps }
