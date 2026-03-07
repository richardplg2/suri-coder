import type { QuizData } from 'renderer/types/api'

interface QuizCardProps {
  data: QuizData
  onSubmit: (answer: string) => void
  disabled?: boolean
}

export function QuizCard({ data, onSubmit, disabled }: QuizCardProps) {
  // Placeholder — full implementation in Task 4
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="text-[14px] font-semibold">{data.question}</h4>
      <p className="text-caption text-muted-foreground">{data.context}</p>
    </div>
  )
}
