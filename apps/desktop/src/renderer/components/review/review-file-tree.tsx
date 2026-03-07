import { ScrollArea, Badge } from '@agent-coding/ui'
import { cn } from '@agent-coding/ui'
import { FilePlus, FileEdit, FileMinus, FileSymlink } from 'lucide-react'
import type { ReviewFile } from 'renderer/components/review/review-panel'

interface ReviewFileTreeProps {
  files: ReviewFile[]
  selectedFile: string | null
  onSelectFile: (path: string) => void
  commentCounts: Record<string, number>
}

const STATUS_ICONS = {
  added: FilePlus,
  modified: FileEdit,
  deleted: FileMinus,
  renamed: FileSymlink,
}

const STATUS_COLORS = {
  added: 'text-green-400',
  modified: 'text-yellow-400',
  deleted: 'text-red-400',
  renamed: 'text-blue-400',
}

export function ReviewFileTree({ files, selectedFile, onSelectFile, commentCounts }: ReviewFileTreeProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        <div className="section-header px-2 py-1.5 mb-1">
          Files Changed ({files.length})
        </div>
        {files.map((file) => {
          const Icon = STATUS_ICONS[file.status]
          const commentCount = commentCounts[file.path] ?? 0
          const fileName = file.path.split('/').pop()
          const dirPath = file.path.split('/').slice(0, -1).join('/')

          return (
            <button
              key={file.path}
              type="button"
              onClick={() => onSelectFile(file.path)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors',
                selectedFile === file.path
                  ? 'bg-[var(--selection)] text-primary'
                  : 'hover:bg-secondary/50',
              )}
            >
              <Icon className={cn('size-3.5 shrink-0', STATUS_COLORS[file.status])} />
              <div className="flex-1 min-w-0">
                <span className="font-medium">{fileName}</span>
                {dirPath && (
                  <span className="text-muted-foreground ml-1">{dirPath}/</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {file.additions > 0 && (
                  <span className="text-green-400 text-[10px]">+{file.additions}</span>
                )}
                {file.deletions > 0 && (
                  <span className="text-red-400 text-[10px]">-{file.deletions}</span>
                )}
                {commentCount > 0 && (
                  <Badge className="bg-yellow-500/15 text-yellow-400 text-[9px] px-1 py-0">
                    {commentCount}
                  </Badge>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </ScrollArea>
  )
}
