import { Component, type ErrorInfo, type ReactNode } from 'react'
import { isRouteErrorResponse, useRouteError } from 'react-router-dom'

/** Parse component stack string into individual component entries. */
function parseComponentStack(stack: string): { name: string; source?: string }[] {
  return stack
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // Format: "at ComponentName (source:line:col)" or "at ComponentName"
      const match = line.match(/^at\s+(\S+?)(?:\s+\((.+)\))?$/)
      if (match) return { name: match[1], source: match[2] }
      return { name: line }
    })
}

function ErrorDisplay({
  message,
  stack,
  componentStack,
  onReload,
  onCopy,
  onDismiss,
}: {
  message: string
  stack?: string
  componentStack?: string
  onReload: () => void
  onCopy: () => void
  onDismiss?: () => void
}) {
  const components = componentStack ? parseComponentStack(componentStack) : []

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background p-8">
      <div className="max-w-2xl w-full space-y-4">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            The app encountered an unexpected error. You can copy the details below to help with
            debugging.
          </p>
        </div>

        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 space-y-3">
          <p className="text-sm font-medium text-destructive">{message}</p>

          {components.length > 0 && (
            <details className="text-xs" open>
              <summary className="cursor-pointer font-medium text-foreground hover:text-foreground/80">
                Component tree (top = error source)
              </summary>
              <div className="mt-2 max-h-48 overflow-auto rounded bg-muted p-3 space-y-0.5">
                {components.map((c, i) => (
                  <div key={`${c.name}-${i}`} className="flex items-baseline gap-1.5">
                    <span
                      className={
                        i === 0
                          ? 'font-bold text-destructive'
                          : 'text-muted-foreground'
                      }
                    >
                      {'  '.repeat(i)}
                      {i === 0 ? '\u25B6 ' : '\u2514 '}
                      {c.name}
                    </span>
                    {c.source && (
                      <span className="text-muted-foreground/60 truncate">{c.source}</span>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}

          {stack && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Stack trace
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-muted-foreground">
                {stack}
              </pre>
            </details>
          )}

          {componentStack && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Raw component stack
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3 text-muted-foreground">
                {componentStack}
              </pre>
            </details>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onReload}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Reload app
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            Copy error details
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Try to continue
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function buildCopyText(message: string, stack?: string, componentStack?: string) {
  return [message, stack && `Stack trace:\n${stack}`, componentStack && `Component stack:\n${componentStack}`]
    .filter(Boolean)
    .join('\n\n')
}

/**
 * Route-level error fallback for React Router.
 * Use as `errorElement={<RouteErrorFallback />}` on routes.
 */
export function RouteErrorFallback() {
  const error = useRouteError()

  let message: string
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message = `${error.status} ${error.statusText}`
  } else if (error instanceof Error) {
    message = error.message
    stack = error.stack
  } else {
    message = String(error)
  }

  return (
    <ErrorDisplay
      message={message}
      stack={stack}
      onReload={() => window.location.reload()}
      onCopy={() => navigator.clipboard.writeText(buildCopyText(message, stack))}
    />
  )
}

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * Class-based error boundary that captures component stack from componentDidCatch.
 * Wrap route content to catch render errors before React Router does.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    const { error, errorInfo } = this.state
    const message = error?.message ?? 'Unknown error'
    const componentStack = errorInfo?.componentStack ?? undefined

    return (
      <ErrorDisplay
        message={message}
        stack={error?.stack}
        componentStack={componentStack}
        onReload={() => window.location.reload()}
        onCopy={() =>
          navigator.clipboard.writeText(buildCopyText(message, error?.stack, componentStack))
        }
        onDismiss={() => this.setState({ hasError: false, error: null, errorInfo: null })}
      />
    )
  }
}
