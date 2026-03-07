import { useState, useEffect } from 'react'
import { ScrollArea, Button, Textarea, Separator, KVRow } from '@agent-coding/ui'
import { Save, Trash2, StickyNote } from 'lucide-react'
import type { FlatNode } from 'renderer/components/figma/figma-node-tree'

interface FigmaAnnotationPanelProps {
  selectedNode: FlatNode | null
  annotations: Record<string, { text: string; nodeName: string; nodeType: string }>
  onSaveAnnotation: (nodeId: string, text: string) => void
  onDeleteAnnotation: (nodeId: string) => void
  onSelectNode: (nodeId: string) => void
}

export function FigmaAnnotationPanel({
  selectedNode,
  annotations,
  onSaveAnnotation,
  onDeleteAnnotation,
  onSelectNode,
}: FigmaAnnotationPanelProps) {
  const [noteText, setNoteText] = useState('')

  // Only reset note text when the selected node changes, not on every annotation mutation
  useEffect(() => {
    if (selectedNode) {
      setNoteText(annotations[selectedNode.id]?.text ?? '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode?.id])

  const handleSave = () => {
    if (!selectedNode) return
    onSaveAnnotation(selectedNode.id, noteText.trim())
  }

  const annotationEntries = Object.entries(annotations)

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {selectedNode ? (
          <>
            <div>
              <h3 className="text-[13px] font-semibold mb-2">{selectedNode.name}</h3>
              <div className="space-y-1">
                <KVRow label="Type" value={selectedNode.type} />
                {selectedNode.absoluteBoundingBox && (
                  <KVRow
                    label="Size"
                    value={`${Math.round(selectedNode.absoluteBoundingBox.width)} x ${Math.round(selectedNode.absoluteBoundingBox.height)}`}
                  />
                )}
                {selectedNode.characters && (
                  <KVRow
                    label="Text"
                    value={
                      <span className="text-muted-foreground italic truncate max-w-40 inline-block">
                        "{selectedNode.characters}"
                      </span>
                    }
                  />
                )}
              </div>
            </div>

            <Separator />

            <div>
              <label className="text-[11px] text-muted-foreground uppercase block mb-1.5">Annotation</label>
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Describe this element's behavior, layout intent, interactions..."
                rows={5}
                className="text-[13px]"
              />
              <Button size="sm" onClick={handleSave} className="mt-2" disabled={!noteText.trim()}>
                <Save className="mr-1.5 size-3" /> Save Note
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-[13px]">
            <StickyNote className="size-8 mb-2 opacity-30" />
            Select a node to annotate
          </div>
        )}

        <Separator />

        <div>
          <h3 className="text-[11px] text-muted-foreground uppercase mb-2">
            All Annotations ({annotationEntries.length})
          </h3>
          {annotationEntries.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">No annotations yet.</p>
          ) : (
            <div className="space-y-2">
              {annotationEntries.map(([nodeId, anno]) => (
                <div
                  key={nodeId}
                  className="rounded-lg border border-border bg-card p-3 cursor-pointer hover:bg-secondary/30"
                  onClick={() => onSelectNode(nodeId)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium text-primary">{anno.nodeName}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteAnnotation(nodeId)
                      }}
                      className="text-muted-foreground hover:text-red-400"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                  <p className="text-[12px] text-muted-foreground line-clamp-2">{anno.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  )
}
