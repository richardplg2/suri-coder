import { useState, useCallback } from 'react'
import { Button, Textarea } from '@agent-coding/ui'
import { Sparkles } from 'lucide-react'
import { FigmaViewer } from 'renderer/components/figma/figma-viewer'
import { useBrainstormStart } from 'renderer/hooks/queries/use-brainstorm'
import { useTabStore } from 'renderer/stores/use-tab-store'
import { generateFigmaMarkdown } from 'renderer/lib/figma-export'
import type { FigmaNode } from 'renderer/hooks/use-figma-connection'

interface Annotation {
  text: string
  nodeName: string
  nodeType: string
}

interface FigmaImportScreenProps {
  projectId: string
}

export function FigmaImportScreen({ projectId }: FigmaImportScreenProps) {
  const [overallDescription, setOverallDescription] = useState('')
  const [figmaData, setFigmaData] = useState<{
    annotations: Record<string, Annotation>
    nodeTree: FigmaNode
    imageDataUrl: string
  } | null>(null)

  const startBrainstorm = useBrainstormStart(projectId)

  const handleAnnotationsReady = useCallback(
    (annotations: Record<string, Annotation>, nodeTree: FigmaNode, imageDataUrl: string) => {
      setFigmaData({ annotations, nodeTree, imageDataUrl })
    },
    [],
  )

  const handleSendToAI = () => {
    if (!figmaData) return

    const markdown = generateFigmaMarkdown(figmaData.nodeTree, figmaData.annotations, false)

    startBrainstorm.mutate(
      {
        figma_data: {
          overall_description: overallDescription,
          design_markdown: markdown,
          annotations: figmaData.annotations,
          node_tree_name: figmaData.nodeTree.name,
          node_tree_type: figmaData.nodeTree.type,
        },
      },
      {
        onSuccess: () => {
          useTabStore.getState().openBrainstormTab(projectId, `Brainstorm: ${figmaData.nodeTree.name}`)
        },
      },
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-hidden">
        <FigmaViewer onAnnotationsReady={handleAnnotationsReady} />
      </div>

      <div className="border-t border-border p-4">
        <div className="mx-auto max-w-3xl">
          <label className="text-[11px] text-muted-foreground uppercase block mb-1.5">Overall Description</label>
          <Textarea
            value={overallDescription}
            onChange={(e) => setOverallDescription(e.target.value)}
            placeholder="Describe the overall feature, user flow, or context for this design..."
            rows={3}
            className="text-[13px]"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-caption text-muted-foreground">
              {figmaData
                ? `${Object.keys(figmaData.annotations).length} annotations ready`
                : 'Load a Figma design first'}
            </span>
            <Button onClick={handleSendToAI} disabled={!figmaData || startBrainstorm.isPending}>
              <Sparkles className="mr-1.5 size-3.5" />
              Send to AI Agent
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
