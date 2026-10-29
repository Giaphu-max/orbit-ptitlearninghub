import { Check, CircleDot, Wrench } from 'lucide-react'
import type { Lesson, LessonQuizQuestion } from '@/data/types'
import { formatTime } from '@/lib/youtube'
import { QUIZ_XP } from '@/lib/quiz'
import type { QuizResult } from '@/store/useOrbitStore'

const STATUS = {
    correct: { label: 'đã đúng', className: 'bg-success text-ink-foreground', icon: Check },
    corrected: { label: 'đã sửa được', className: 'bg-success text-ink-foreground', icon: Wrench },
    missed: { label: 'cần ôn lại', className: 'bg-brand-600 text-ink-foreground', icon: CircleDot },
} as const

interface QuizListProps {
    lesson: Lesson
    results: Record<string, QuizResult>
    onOpen: (q: LessonQuizQuestion) => void
    onSeek: (sec: number) => void
}

/** Tab Câu hỏi: vòng trạng thái, câu hỏi, trạng thái + XP; bấm câu để làm/ôn, bấm mốc để tua. */
export function QuizList({ lesson, results, onOpen, onSeek }: QuizListProps) {
    if (!lesson.quiz.length) return <p className="p-4 text-sm text-muted-foreground">Bài này chưa có câu hỏi trong video.</p>

    return (
        <ol className="h-full min-h-0 overflow-y-auto overscroll-contain p-4">
            {lesson.quiz.map((q) => {
                const result = results[q.id]
                const status = result ? STATUS[result.outcome] : null
                const Icon = status?.icon
                const xp = result ? QUIZ_XP[result.outcome] : 0
                return (
                    <li key={q.id} className="grid grid-cols-[22px_1fr_auto] items-start gap-2.5 rounded-xl px-2.5 py-3 transition hover:bg-muted [&+li]:border-t [&+li]:border-border">
                        <span
                            aria-hidden
                            className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full ${status ? status.className : 'border-2 border-dashed border-muted-foreground/50'}`}
                        >
                            {Icon && <Icon size={12} strokeWidth={3} />}
                        </span>
                        <button type="button" onClick={() => onOpen(q)} className="min-w-0 text-left">
                            <span className="block text-sm font-semibold leading-snug text-strong">{q.prompt}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                                {status ? `${status.label}${xp ? ` · +${xp} XP` : ''}` : 'video dừng ở mốc này'}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onSeek(q.pauseAt)}
                            title="Tua tới mốc câu hỏi"
                            className="font-mono text-xs font-bold text-brand-ink hover:underline"
                        >
                            {formatTime(q.pauseAt)}
                        </button>
                    </li>
                )
            })}
        </ol>
    )
}
