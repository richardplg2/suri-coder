import type { FigmaNode } from 'renderer/hooks/use-figma-connection'

interface Annotation {
  text: string
  nodeName: string
  nodeType: string
}

export function generateFigmaMarkdown(
  nodeTree: FigmaNode,
  annotations: Record<string, Annotation>,
  includeStyles = false,
): string {
  const lines: string[] = []
  const bbox = nodeTree.absoluteBoundingBox

  lines.push(`# Screen: ${nodeTree.name}`)
  lines.push(
    `> Type: ${nodeTree.type} | Size: ${bbox ? `${Math.round(bbox.width)}x${Math.round(bbox.height)}` : 'unknown'}`,
  )
  lines.push('')
  lines.push('## Structure')
  lines.push('')

  function hasImageFill(node: FigmaNode): boolean {
    return node.fills?.some((f) => f.type === 'IMAGE') ?? false
  }

  function formatStyle(node: FigmaNode): string {
    if (!includeStyles) return ''
    const parts: string[] = []
    if (node.style) {
      const s = node.style
      if (s.fontFamily) {
        parts.push(`${s.fontFamily} ${s.fontStyle ?? ''} ${s.fontSize ? `${Math.round(s.fontSize)}px` : ''}`.trim())
      }
      if (s.fontWeight) parts.push(`weight: ${s.fontWeight}`)
      if (s.letterSpacing) parts.push(`spacing: ${s.letterSpacing}`)
      if (s.lineHeightPx) parts.push(`line-height: ${Math.round(s.lineHeightPx)}px`)
      if (s.textAlignHorizontal) parts.push(`align: ${s.textAlignHorizontal}`)
    }
    if (node.fills?.length) {
      const solid = node.fills.find((f) => f.type === 'SOLID' && f.color)
      if (solid) parts.push(`color: ${solid.color}`)
    }
    if (node.cornerRadius) parts.push(`radius: ${Math.round(node.cornerRadius)}px`)
    const nb = node.absoluteBoundingBox
    if (nb) parts.push(`${Math.round(nb.width)}x${Math.round(nb.height)}`)
    return parts.length ? `\n  _Style: ${parts.join(' | ')}_` : ''
  }

  function walkNode(node: FigmaNode, depth: number): void {
    const nb = node.absoluteBoundingBox
    const size = nb ? `${Math.round(nb.width)}x${Math.round(nb.height)}` : ''
    const anno = annotations[node.id]

    if (depth === 1) {
      lines.push(`### ${node.name} (${node.type})`)
      if (node.characters) lines.push(`> Text: "${node.characters}"`)
      if (hasImageFill(node)) lines.push(`> [Image: ${node.name}, ${size}]`)
      lines.push(formatStyle(node))
      if (anno) lines.push(`\n**Note:** ${anno.text}`)
      lines.push('')
    } else if (depth >= 2) {
      const indent = '  '.repeat(depth - 2)
      let line = `${indent}- **${node.name}** (${node.type})`
      if (node.characters) line += `: "${node.characters}"`
      lines.push(line)
      if (hasImageFill(node)) lines.push(`${indent}  > [Image: ${node.name}, ${size}]`)
      if (includeStyles) {
        const style = formatStyle(node)
        if (style) lines.push(`${indent}  ${style.trim()}`)
      }
      if (anno) lines.push(`${indent}  > **Note:** ${anno.text}`)
    }

    if (node.children) {
      for (const child of node.children) {
        walkNode(child, depth + 1)
      }
    }
  }

  walkNode(nodeTree, 0)
  return lines.join('\n')
}
