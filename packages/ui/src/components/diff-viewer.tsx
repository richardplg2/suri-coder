import * as React from 'react'

import { cn } from '@/lib/utils'

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  content: string
  lineNumber?: { old?: number; new?: number }
}

interface DiffViewerProps extends React.ComponentProps<'div'> {
  lines: DiffLine[]
  renderLineAnnotation?: (lineIndex: number) => React.ReactNode
}

const lineTypeStyles: Record<DiffLine['type'], string> = {
  added: 'bg-[var(--success)]/8 text-[var(--success)]',
  removed: 'bg-destructive/8 text-destructive',
  unchanged: 'text-foreground',
}

const lineTypePrefix: Record<DiffLine['type'], string> = {
  added: '+',
  removed: '-',
  unchanged: ' ',
}

function DiffViewer({
  className,
  lines,
  renderLineAnnotation,
  ...props
}: DiffViewerProps) {
  return (
    <div
      className={cn('overflow-auto rounded-md border border-border font-mono text-[12px]', className)}
      data-slot="diff-viewer"
      {...props}
    >
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((line, index) => (
            <React.Fragment key={index}>
              <tr className={cn('leading-5', lineTypeStyles[line.type])}>
                <td className="w-10 select-none border-r border-border px-2 text-right text-muted-foreground/50">
                  {line.lineNumber?.old ?? ''}
                </td>
                <td className="w-10 select-none border-r border-border px-2 text-right text-muted-foreground/50">
                  {line.lineNumber?.new ?? ''}
                </td>
                <td className="w-5 select-none text-center">
                  {lineTypePrefix[line.type]}
                </td>
                <td className="whitespace-pre px-2">
                  {line.content}
                </td>
              </tr>
              {renderLineAnnotation?.(index)}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export { DiffViewer }
export type { DiffViewerProps, DiffLine }
