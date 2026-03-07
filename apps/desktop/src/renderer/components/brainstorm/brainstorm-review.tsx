interface BrainstormReviewProps {
  summary: string
  specs: Record<string, string>
  sessionId: string
  projectId: string
}

export function BrainstormReview({ summary, specs, sessionId, projectId }: BrainstormReviewProps) {
  // Placeholder — full implementation in Task 8
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-muted-foreground">Review screen placeholder</p>
    </div>
  )
}
