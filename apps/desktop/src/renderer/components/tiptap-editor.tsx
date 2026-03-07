import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { Button } from '@agent-coding/ui'
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, Code } from 'lucide-react'

interface TiptapEditorProps {
  content: string
  onChange?: (content: string) => void
  editable?: boolean
  placeholder?: string
  onSelectionChange?: (selection: { from: number; to: number; text: string } | null) => void
  className?: string
}

export function TiptapEditor({
  content,
  onChange,
  editable = true,
  placeholder = 'Start typing...',
  onSelectionChange,
  className,
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to, ' ')
        onSelectionChange?.({ from, to, text })
      } else {
        onSelectionChange?.(null)
      }
    },
  })

  if (!editor) return null

  return (
    <div className={className}>
      {editable && (
        <div className="flex items-center gap-1 border-b border-border px-2 py-1" role="toolbar" aria-label="Text formatting">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive('bold') ? 'bg-secondary' : ''}
            aria-label="Bold"
          >
            <Bold className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive('italic') ? 'bg-secondary' : ''}
            aria-label="Italic"
          >
            <Italic className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={editor.isActive('heading', { level: 1 }) ? 'bg-secondary' : ''}
            aria-label="Heading 1"
          >
            <Heading1 className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive('heading', { level: 2 }) ? 'bg-secondary' : ''}
            aria-label="Heading 2"
          >
            <Heading2 className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive('bulletList') ? 'bg-secondary' : ''}
            aria-label="Bullet list"
          >
            <List className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive('orderedList') ? 'bg-secondary' : ''}
            aria-label="Ordered list"
          >
            <ListOrdered className="size-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={editor.isActive('codeBlock') ? 'bg-secondary' : ''}
            aria-label="Code block"
          >
            <Code className="size-3.5" />
          </Button>
        </div>
      )}

      <EditorContent
        editor={editor}
        className="prose prose-sm prose-invert max-w-none p-4 focus:outline-none [&_.ProseMirror]:min-h-[200px] [&_.ProseMirror]:outline-none"
      />
    </div>
  )
}
