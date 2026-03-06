import * as React from 'react'
import { Bot, MessageSquare } from 'lucide-react'


interface InlineCommentProps extends React.ComponentProps<'tr'> {
  author?: 'ai' | 'user'
  content: string
  actions?: React.ReactNode
}

function InlineComment({
  className,
  author = 'ai',
  content,
  actions,
  ...props
}: InlineCommentProps) {
  return (
    <tr className={className} data-slot="inline-comment" {...props}>
      <td colSpan={4}>
        <div
          className="mx-3 my-1 rounded-md border border-primary/20 bg-primary/5 p-3"
        >
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-primary">
            {author === 'ai' ? (
              <Bot className="size-3.5" />
            ) : (
              <MessageSquare className="size-3.5" />
            )}
            {author === 'ai' ? 'AI Review' : 'Comment'}
          </div>
          <p className="text-[12px] leading-relaxed text-foreground">{content}</p>
          {actions && (
            <div className="mt-2 flex items-center gap-2">
              {actions}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

export { InlineComment }
export type { InlineCommentProps }
