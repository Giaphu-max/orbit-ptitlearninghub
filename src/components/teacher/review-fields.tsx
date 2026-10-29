import { useState, type ReactNode } from 'react'
import { ChevronDown, Check, Loader2, Sparkles } from 'lucide-react'
import type { QuizChoiceQuestion } from '@/data/types'
import { pct, questionPicks, topTrap } from '@/lib/teacher'

export const fieldCls =
    'w-full resize-y rounded-[10px] border border-border bg-card px-[11px] py-[9px] text-sm leading-normal text-foreground transition duration-fast focus-visible:border-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-200'
export const labelCls = 'mb-1.5 mt-3 block text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground'

/** Vòng tick đầu dòng: đã duyệt = xanh teal có dấu ✓, chưa = vòng nét đứt. */
export function Tick({ done }: { done: boolean }) {
    return (
        <span
            aria-hidden
            className={`flex h-[22px] w-[22px] items-center justify-center rounded-full text-ink-foreground ${done ? 'bg-mm-teal' : 'border-2 border-dashed border-muted-foreground/40'}`}
        >
            {done && <Check size={12} strokeWidth={3.5} />}
        </span>
    )
}

interface RowProps {
    domId: string
    open: boolean
    done: boolean
    title: string
    sub: string
    rate?: number | null
    hot?: boolean
    onToggle: () => void
    children: ReactNode
}

/** Một dòng gọn trong danh sách duyệt; mở ra thì hiện các trường sửa tại chỗ. */
export function ReviewRow({ domId, open, done, title, sub, rate, hot, onToggle, children }: RowProps) {
    return (
        <div id={domId} className={`rounded-[14px] border transition duration-fast ${open ? 'border-border bg-card shadow-raised' : 'border-transparent'}`}>
            <button
                type="button"
                aria-expanded={open}
                onClick={onToggle}
                className={`grid w-full grid-cols-[24px_1fr_auto_14px] items-center gap-2.5 px-2.5 py-[11px] text-left transition hover:bg-muted ${open ? 'rounded-t-[14px]' : 'rounded-[14px]'}`}
            >
                <Tick done={done} />
                <span className="min-w-0">
                    <b className="line-clamp-2 text-sm font-semibold leading-snug text-strong">{title}</b>
                    <small className="mt-0.5 block font-mono text-xs text-muted-foreground">{sub}</small>
                </span>
                <span className={`font-mono text-[12.5px] font-extrabold ${hot ? 'text-brand-ink' : 'text-muted-foreground'}`}>{rate != null ? `${rate}%` : ''}</span>
                <ChevronDown size={13} className={`text-muted-foreground transition-transform duration-fast ${open ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {open && <div className="px-3.5 pb-3.5 pt-0.5">{children}</div>}
        </div>
    )
}

/** Hàng nút cuối dòng mở: Duyệt (navy) / ✓ Đã duyệt (xanh), nút AI phụ, chip seek bên phải. */
export function ItemActions({
    approved,
    approveLabel,
    onApprove,
    ai,
    seek,
}: {
    approved: boolean
    approveLabel: string
    onApprove: () => void
    ai?: { label: string; busy: boolean; onClick: () => void }
    seek: { label: string; onClick: () => void }
}) {
    return (
        <div className="mt-3.5 flex items-center gap-2">
            <button
                type="button"
                onClick={onApprove}
                className={`inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3.5 text-[13.5px] font-bold transition ${
                    approved ? 'bg-success-soft text-success' : 'bg-strong text-background hover:opacity-90'
                }`}
            >
                {approved ? (
                    <>
                        <Check size={14} strokeWidth={3} aria-hidden /> Đã duyệt
                    </>
                ) : (
                    approveLabel
                )}
            </button>
            {ai && (
                <button
                    type="button"
                    disabled={ai.busy}
                    onClick={ai.onClick}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-border bg-card px-3 text-[13px] font-bold text-strong transition hover:bg-muted disabled:cursor-wait disabled:opacity-70"
                >
                    {ai.busy ? <Loader2 size={13} className="animate-spin" aria-hidden /> : <Sparkles size={13} aria-hidden />}
                    {ai.busy ? 'Đang tạo…' : ai.label}
                </button>
            )}
            <button type="button" onClick={seek.onClick} className="ml-auto rounded-[7px] bg-brand-50 px-2.5 py-1.5 font-mono text-xs font-bold text-brand-ink transition hover:bg-brand-100">
                ▶ {seek.label}
            </button>
        </div>
    )
}

/** 4 đáp án: bấm vòng tròn để chọn đáp án đúng, sửa chữ tại chỗ; có số liệu thì hiện % sinh viên chọn. */
export function OptionRows({ question, onChange, showPicks = false }: { question: QuizChoiceQuestion & { id: string }; onChange: (next: QuizChoiceQuestion) => void; showPicks?: boolean }) {
    const picks = showPicks ? questionPicks(question.id) : null
    const total = picks?.reduce((a, b) => a + b, 0) ?? 0
    const trap = showPicks ? topTrap(question) : null
    return (
        <div>
            {question.options.map((opt, i) => {
                const right = i === question.correctIndex
                const share = picks ? pct(picks[i] ?? 0, total) : null
                const isTrap = trap?.index === i && (trap.share ?? 0) >= 20
                return (
                    <div
                        key={i}
                        className={`mt-1.5 grid grid-cols-[20px_1fr_auto] items-center gap-2 rounded-[10px] border px-2.5 py-1.5 text-[13.5px] ${
                            right ? 'border-success-soft-border bg-success-soft' : 'border-border'
                        }`}
                    >
                        <button
                            type="button"
                            aria-label={`Đáp án ${i + 1} là đáp án đúng`}
                            aria-pressed={right}
                            onClick={() => onChange({ ...question, correctIndex: i })}
                            className={`h-4 w-4 rounded-full ${right ? 'border-[5px] border-success' : 'border-2 border-muted-foreground/40'}`}
                        />
                        <input
                            value={opt}
                            aria-label={`Đáp án ${i + 1}`}
                            onChange={(e) => onChange({ ...question, options: question.options.map((o, j) => (j === i ? e.target.value : o)) })}
                            className="min-w-0 bg-transparent py-0.5 text-foreground focus-visible:outline-none focus-visible:underline"
                        />
                        {share !== null && <em className={`font-mono text-[11.5px] font-bold not-italic ${isTrap ? 'text-brand-ink' : 'text-muted-foreground'}`}>{share}%</em>}
                    </div>
                )
            })}
        </div>
    )
}

/** Câu biến thể gộp vào một details để không làm dài dòng. */
export function VariantsBox({ variants, onChange }: { variants: (QuizChoiceQuestion & { id: string })[]; onChange: (i: number, next: QuizChoiceQuestion) => void }) {
    const [open, setOpen] = useState(false)
    if (variants.length === 0) return null
    return (
        <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="mt-3 border-t border-dashed border-border pt-2.5">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-[13px] font-bold text-strong [&::-webkit-details-marker]:hidden">
                Câu biến thể cho vòng củng cố <span className="font-mono text-xs font-semibold text-muted-foreground">{variants.length} câu</span>
            </summary>
            {variants.map((v, i) => (
                <div key={v.id} className="mt-1">
                    <label className={labelCls} htmlFor={`${v.id}-prompt`}>
                        Câu hỏi
                    </label>
                    <textarea id={`${v.id}-prompt`} rows={2} value={v.prompt} onChange={(e) => onChange(i, { ...v, prompt: e.target.value })} className={fieldCls} />
                    <OptionRows question={v} onChange={(next) => onChange(i, next)} />
                    <label className={labelCls} htmlFor={`${v.id}-explain`}>
                        Giải thích khi sinh viên sai
                    </label>
                    <textarea id={`${v.id}-explain`} rows={2} value={v.explanation} onChange={(e) => onChange(i, { ...v, explanation: e.target.value })} className={fieldCls} />
                </div>
            ))}
        </details>
    )
}
