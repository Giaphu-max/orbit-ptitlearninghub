import { pct, questionPicks } from '@/lib/teacher'
import type { QuizChoiceQuestion } from '@/data/types'

/** Phân bố đáp án của một câu: đáp án nhiễu cao nhất đỏ nhạt, đáp án đúng xanh. Không có dữ liệu thì không vẽ gì. */
export function AnswerBars({ question, compact = false }: { question: QuizChoiceQuestion & { id: string }; compact?: boolean }) {
    const picks = questionPicks(question.id)
    if (!picks) return null
    const total = picks.reduce((a, b) => a + b, 0)
    let trap = -1
    picks.forEach((n, i) => {
        if (i !== question.correctIndex && (trap < 0 || n > picks[trap])) trap = i
    })
    return (
        <ul className="flex flex-col gap-2" aria-label="Sinh viên chọn đáp án nào">
            {question.options.map((opt, i) => {
                const share = pct(picks[i] ?? 0, total)
                const right = i === question.correctIndex
                const hot = i === trap && share >= 20
                return (
                    <li key={i} className={`rounded-[10px] px-2.5 py-2 ${hot ? 'bg-brand-50' : ''}`}>
                        <div className="flex items-start justify-between gap-3 text-[13px] leading-snug">
                            <span className={`min-w-0 ${compact ? 'line-clamp-1' : ''} ${right ? 'font-bold text-success' : hot ? 'font-semibold text-brand-ink' : 'text-muted-foreground'}`}>
                                <span className="mr-1.5 font-mono font-bold">{String.fromCharCode(65 + i)}</span>
                                {opt}
                            </span>
                            <span className={`shrink-0 font-mono text-[12.5px] font-bold ${hot ? 'text-brand-ink' : right ? 'text-success' : 'text-muted-foreground'}`}>{share}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className={`h-full rounded-full ${right ? 'bg-success' : hot ? 'bg-brand-400' : 'bg-muted-foreground/40'}`} style={{ width: `${share}%` }} />
                        </div>
                    </li>
                )
            })}
        </ul>
    )
}
