import { useState } from 'react'
import { CodeBlock } from '@agent-coding/ui'
import { CheckCircle, XCircle, ChevronDown, ChevronRight, Camera, SkipForward } from 'lucide-react'
import type { TestResult } from 'renderer/types/api'

interface TestResultsPanelProps {
  results: TestResult[]
}

export function TestResultsPanel({ results }: TestResultsPanelProps) {
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set())
  const passed = results.filter((r) => r.status === 'passed').length
  const failed = results.filter((r) => r.status === 'failed').length
  const skipped = results.filter((r) => r.status === 'skipped').length
  const failedTests = results.filter((r) => r.status === 'failed')

  const toggleExpand = (name: string) => {
    setExpandedTests((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-3 px-4 py-2 bg-card">
        <span className="text-[13px] font-medium">Test Results</span>
        <div className="flex items-center gap-2 text-[12px]">
          <span className="flex items-center gap-1 text-green-400">
            <CheckCircle className="size-3" /> {passed} passed
          </span>
          {failed > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <XCircle className="size-3" /> {failed} failed
            </span>
          )}
          {skipped > 0 && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <SkipForward className="size-3" /> {skipped} skipped
            </span>
          )}
        </div>
      </div>

      {failedTests.length > 0 && (
        <div className="px-4 pb-3 space-y-2">
          {failedTests.map((test) => (
            <div key={test.name} className="rounded-lg border border-red-500/30 bg-red-500/5">
              <button
                type="button"
                onClick={() => toggleExpand(test.name)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
              >
                {expandedTests.has(test.name) ? (
                  <ChevronDown className="size-3.5" />
                ) : (
                  <ChevronRight className="size-3.5" />
                )}
                <XCircle className="size-3.5 text-red-400" />
                <span className="text-[12px] font-medium flex-1">{test.name}</span>
                <span className="text-[10px] text-muted-foreground">{test.duration_ms}ms</span>
              </button>

              {expandedTests.has(test.name) && (
                <div className="border-t border-red-500/20 px-3 py-2 space-y-2">
                  {test.error_message && (
                    <p className="text-[12px] text-red-300">{test.error_message}</p>
                  )}
                  {test.stack_trace && (
                    <CodeBlock
                      code={test.stack_trace}
                      language="text"
                      className="text-[11px] max-h-48 overflow-y-auto"
                    />
                  )}
                  {test.screenshot_url && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-secondary/50"
                    >
                      <Camera className="size-3" /> View Screenshot
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
