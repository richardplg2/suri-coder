import * as React from 'react'
import { ChevronRight, File, Folder } from 'lucide-react'

import { cn } from '@/lib/utils'

type FileStatus = 'modified' | 'added' | 'deleted' | 'unchanged'

interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  status?: FileStatus
  children?: FileTreeNode[]
}

interface FileTreeProps extends Omit<React.ComponentProps<'div'>, 'onSelect'> {
  nodes: FileTreeNode[]
  selectedPath?: string
  onSelect?: (path: string) => void
  expandedPaths?: Set<string>
  onToggleExpand?: (path: string) => void
}

const statusColors: Record<FileStatus, string> = {
  modified: 'text-[var(--warning)]',
  added: 'text-[var(--success)]',
  deleted: 'text-destructive',
  unchanged: 'text-muted-foreground',
}

const statusIcons: Record<FileStatus, string> = {
  modified: '\u25CF',
  added: '+',
  deleted: '\u2212',
  unchanged: '',
}

function FileTreeRow({
  node,
  depth,
  selectedPath,
  onSelect,
  expandedPaths,
  onToggleExpand,
}: {
  node: FileTreeNode
  depth: number
  selectedPath?: string
  onSelect?: (path: string) => void
  expandedPaths?: Set<string>
  onToggleExpand?: (path: string) => void
}) {
  const isDir = node.type === 'directory'
  const isExpanded = expandedPaths?.has(node.path) ?? false
  const isSelected = selectedPath === node.path
  const status = node.status ?? 'unchanged'

  return (
    <>
      <button
        type="button"
        role="treeitem"
        aria-expanded={isDir ? isExpanded : undefined}
        aria-selected={isSelected}
        onClick={() => {
          if (isDir) onToggleExpand?.(node.path)
          else onSelect?.(node.path)
        }}
        className={cn(
          'flex w-full cursor-pointer items-center gap-1.5 rounded-sm px-2 py-0.5 text-[13px] transition-colors duration-150',
          isSelected
            ? 'bg-[var(--selection)] text-primary'
            : 'text-foreground hover:bg-secondary'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {isDir ? (
          <ChevronRight
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform duration-150',
              isExpanded && 'rotate-90'
            )}
          />
        ) : (
          <span className="w-3.5" />
        )}
        {isDir ? (
          <Folder className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <File className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1 truncate text-left">{node.name}</span>
        {status !== 'unchanged' && (
          <span className={cn('shrink-0 text-xs font-bold', statusColors[status])}>
            {statusIcons[status]}
          </span>
        )}
      </button>
      {isDir && isExpanded &&
        node.children?.map((child) => (
          <FileTreeRow
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelect={onSelect}
            expandedPaths={expandedPaths}
            onToggleExpand={onToggleExpand}
          />
        ))}
    </>
  )
}

function FileTree({
  className,
  nodes,
  selectedPath,
  onSelect,
  expandedPaths,
  onToggleExpand,
  ...props
}: FileTreeProps) {
  return (
    <div
      className={cn('space-y-px py-1 font-mono text-[12px]', className)}
      role="tree"
      data-slot="file-tree"
      {...props}
    >
      {nodes.map((node) => (
        <FileTreeRow
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
          expandedPaths={expandedPaths}
          onToggleExpand={onToggleExpand}
        />
      ))}
    </div>
  )
}

export { FileTree }
export type { FileTreeProps, FileTreeNode, FileStatus }
