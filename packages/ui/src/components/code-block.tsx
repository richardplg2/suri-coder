import * as React from 'react'
import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { createHighlighter, type Highlighter } from 'shiki'

import { cn } from '@/lib/utils'

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: ['typescript', 'javascript', 'python', 'json', 'bash', 'css', 'html', 'tsx', 'jsx', 'yaml', 'markdown'],
    })
  }
  return highlighterPromise
}

function useIsDark() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains('dark'),
  )

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return isDark
}

interface CodeBlockProps extends React.ComponentProps<'div'> {
  code: string
  language?: string
  showLineNumbers?: boolean
  showCopyButton?: boolean
}

function CodeBlock({
  className,
  code,
  language = 'typescript',
  showLineNumbers = false,
  showCopyButton = true,
  ...props
}: CodeBlockProps) {
  const [html, setHtml] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const isDark = useIsDark()

  useEffect(() => {
    let mounted = true
    getHighlighter().then((highlighter) => {
      if (!mounted) return
      const result = highlighter.codeToHtml(code, {
        lang: language,
        theme: isDark ? 'github-dark' : 'github-light',
      })
      setHtml(result)
    })
    return () => { mounted = false }
  }, [code, language, isDark])

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div
      className={cn('group relative rounded-md border border-border bg-card', className)}
      data-slot="code-block"
      {...props}
    >
      <div className="flex h-7 items-center justify-between border-b border-border px-3">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {language}
        </span>
        {showCopyButton && (
          <button
            type="button"
            onClick={handleCopy}
            className="cursor-pointer rounded-sm p-1 text-muted-foreground opacity-0 transition-all duration-150 hover:text-foreground group-hover:opacity-100"
            aria-label="Copy code"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </button>
        )}
      </div>
      {html ? (
        <div
          className={cn(
            'overflow-x-auto p-3 text-[12px] leading-relaxed [&_pre]:!bg-transparent [&_code]:!bg-transparent',
            showLineNumbers && '[&_.line::before]:mr-4 [&_.line::before]:inline-block [&_.line::before]:w-4 [&_.line::before]:text-right [&_.line::before]:text-muted-foreground [&_.line::before]:content-[counter(line)] [&_.line]:counter-increment-[line] [&_code]:counter-reset-[line]'
          )}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto p-3 font-mono text-[12px] text-foreground">
          <code>{code}</code>
        </pre>
      )}
    </div>
  )
}

export { CodeBlock }
export type { CodeBlockProps }
