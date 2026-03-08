import { Folder } from 'lucide-react'
import { CodeBlock } from '@agent-coding/ui'
import type { InspectorContent } from 'renderer/stores/use-inspector-store'

function FileBreadcrumb({ filePath }: { filePath: string }) {
  const segments = filePath.split('/')
  return (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/50 bg-[var(--surface)]/30">
      <Folder className="size-3.5 text-muted-foreground shrink-0" />
      <div className="flex items-center text-caption font-mono text-muted-foreground truncate">
        {segments.map((seg, i) => (
          <span key={`${seg}-${i}`} className="flex items-center">
            {i > 0 && <span className="mx-1 text-muted-foreground/50">/</span>}
            <span className={i === segments.length - 1 ? 'text-foreground' : ''}>
              {seg}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function FilePreview({ content }: { content: InspectorContent }) {
  return (
    <div className="flex h-full flex-col">
      {content.filePath && <FileBreadcrumb filePath={content.filePath} />}
      <div className="flex-1 overflow-auto">
        <CodeBlock
          code={content.code ?? ''}
          language={content.language ?? 'typescript'}
          showLineNumbers
        />
      </div>
    </div>
  )
}
