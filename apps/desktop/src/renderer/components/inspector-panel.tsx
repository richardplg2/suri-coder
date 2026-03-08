import { X } from 'lucide-react'
import { cn, Button, DiffViewer } from '@agent-coding/ui'
import type { DiffLine } from '@agent-coding/ui'
import { useInspectorStore } from 'renderer/stores/use-inspector-store'
import { FilePreview } from './inspector/file-preview'

function parsePatch(patch: string): DiffLine[] {
  return patch.split('\n').map((line) => {
    if (line.startsWith('+')) return { type: 'added' as const, content: line.slice(1) }
    if (line.startsWith('-')) return { type: 'removed' as const, content: line.slice(1) }
    return { type: 'unchanged' as const, content: line.startsWith(' ') ? line.slice(1) : line }
  })
}

const CONTENT_LABELS: Record<string, string> = {
  'file-preview': 'File Preview',
  'message-detail': 'Message Detail',
  'diff-viewer': 'Diff Viewer',
}

export function InspectorPanel() {
  const { isOpen, content, close } = useInspectorStore()

  return (
    <aside
      className={cn(
        'shrink-0 border-l border-border/50 bg-[var(--surface)] transition-[width] duration-200 ease-out overflow-hidden',
        isOpen && content ? 'w-80' : 'w-0',
      )}
    >
      <div className="flex h-full w-80 flex-col">
        {/* Header */}
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/50 px-3">
          <span className="section-header">
            {content ? CONTENT_LABELS[content.type] ?? 'Inspector' : 'Inspector'}
          </span>
          <Button variant="ghost" size="icon-sm" className="size-6" onClick={close}>
            <X className="size-3.5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {content?.type === 'file-preview' && <FilePreview content={content} />}
          {content?.type === 'diff-viewer' && content.diff && (
            <div className="h-full overflow-auto">
              <DiffViewer lines={parsePatch(content.diff)} />
            </div>
          )}
          {content?.type === 'message-detail' && (
            <div className="p-3 text-sm text-foreground whitespace-pre-wrap">
              {content.messageContent}
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
