import { CheckCircle2, CircleDashed, CircleDot, Wrench } from 'lucide-react'
import type { Lesson, LessonQuizQuestion } from '@/data/types'
import { formatTime } from '@/lib/youtube'
import type { QuizResult } from '@/store/useOrbitStore'

const STATUS = {
    correct: { icon: CheckCircle2, label: 'Đúng ngay', className: 'text-success' },
    corrected: { icon: Wrench, label: 'Đã sửa được', className: 'text-success' },
    missed: { icon: CircleDot, label: 'Cần ôn lại', className: 'text-brand-ink' },
} as const

interface QuizListProps {
    lesson: Lesson
    results: Record<string, QuizResult>
    onOpen: (q: LessonQuizQuestion) => void
}

/** Danh sách câu hỏi trong bài kèm trạng thái; bấm để làm (hoặc ôn lại). */
export function QuizList({ lesson, results, onOpen }: QuizListProps) {
    if (!lesson.quiz.length) return null
    const done = lesson.quiz.filter((q) => results[q.id]).length

    return (
        <section className="rounded-card border border-border bg-card p-5 shadow-card">
            <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-bold text-gray-900">Câu hỏi trong bài</h2>
                <span className="font-mono text-xs text-gray-500">
                    {done}/{lesson.quiz.length}
                </span>
            </div>
            <ol className="mt-3 space-y-1">
                {lesson.quiz.map((q) => {
                    const result = results[q.id]
                    const status = result ? STATUS[result.outcome] : null
                    const Icon = status?.icon ?? CircleDashed
                    return (
                        <li key={q.id}>
                            <button
                                type="button"
                                onClick={() => onOpen(q)}
                                className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-gray-50"
                            >
                                <Icon size={16} className={`mt-0.5 shrink-0 ${status?.className ?? 'text-gray-300'}`} />
                                <span className="min-w-0 flex-1">
                                    <span className="line-clamp-2 text-gray-800">{q.prompt}</span>
                                    <span className="mt-0.5 block text-xs text-gray-500">
                                        <span className="font-mono">{formatTime(q.pauseAt)}</span> · {status?.label ?? 'Chưa làm'}
                                    </span>
                                </span>
                            </button>
                        </li>
                    )
                })}
            </ol>
        </section>
    )
}
