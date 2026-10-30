import type { ClassStats, QuizChoiceQuestion } from '@/data/types'
import { pct, questionPicks } from '@/lib/teacher'

/**
 * Sinh viên chọn đáp án nào: mỗi đáp án một hàng với số sinh viên (% chỉ là chữ phụ), thanh mảnh 3px ở đáy hàng.
 * Đáp án nhiễu cao nhất nền đỏ nhạt, đáp án đúng nền xanh nhạt. Không có dữ liệu thì không vẽ gì.
 */
export function AnswerBars({ stats, question }: { stats: ClassStats; question: QuizChoiceQuestion & { id: string } }) {
    const picks = questionPicks(stats, question.id)
    if (!picks) return null
    const total = picks.reduce((a, b) => a + b, 0)
    let trap = -1
    picks.forEach((n, i) => {
        if (i !== question.correctIndex && (trap < 0 || n > picks[trap])) trap = i
    })
    return (
        <ul className="flex flex-col gap-1.5" aria-label="Sinh viên chọn đáp án nào">
            {question.options.map((opt, i) => {
                const n = picks[i] ?? 0
                const share = pct(n, total)
                const right = i === question.correctIndex
                const hot = i === trap && share >= 20
                return (
                    <li key={i} className={`relative overflow-hidden rounded-[10px] px-3 pb-2.5 pt-2 ${right ? 'bg-success-soft' : hot ? 'bg-brand-50' : 'bg-muted'}`}>
                        <div className="flex items-start justify-between gap-3 text-[13px] leading-snug">
                            <span className={`min-w-0 ${right ? 'font-bold text-success' : hot ? 'font-semibold text-brand-ink' : 'text-foreground'}`}>
                                <span className="mr-1.5 font-mono font-bold">{String.fromCharCode(65 + i)}</span>
                                {opt}
                            </span>
                            <span className={`shrink-0 whitespace-nowrap font-mono text-[12.5px] font-bold ${right ? 'text-success' : hot ? 'text-brand-ink' : 'text-muted-foreground'}`}>
                                {n} SV <span className="font-medium opacity-70">· {share}%</span>
                            </span>
                        </div>
                        <span aria-hidden className={`absolute inset-x-0 bottom-0 h-[3px] ${right ? 'bg-success-soft-border' : hot ? 'bg-brand-100' : 'bg-border'}`}>
                            <span className={`block h-full ${right ? 'bg-success' : hot ? 'bg-brand-600' : 'bg-muted-foreground/50'}`} style={{ width: `${share}%` }} />
                        </span>
                    </li>
                )
            })}
        </ul>
    )
}
