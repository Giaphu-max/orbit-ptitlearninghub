import { useState } from 'react'
import { blankQuestion, QuestionEditor } from '@/components/teacher/question-editor'
import { ReviewRow } from '@/components/teacher/review-fields'
import type { Lesson } from '@/data/types'
import { correctRate, passCount, removeFromSet, resolveSet, SOURCE_LABEL, suggestInto, upsertCustom, addToSet, type SourcedQuestion, type TestRules, type TestSet } from '@/lib/test-sets'

const SOURCE_CLS: Record<SourcedQuestion['source'], string> = {
    video: 'bg-info/10 text-info',
    variant: 'bg-muted text-strong',
    daily: 'bg-muted text-strong',
    teacher: 'bg-success-soft text-success',
    ai: 'bg-brand-50 text-brand-ink',
}

/** Chip nguồn của một câu hỏi. */
export function SourceChip({ source }: { source: SourcedQuestion['source'] }) {
    return <i className={`rounded-md px-[7px] py-0.5 text-[11px] font-bold not-italic ${SOURCE_CLS[source]}`}>{SOURCE_LABEL[source]}</i>
}

/** Mục duyệt "Đề kiểm tra nhanh" trong trang Duyệt: luật làm bài, câu trong đề, câu còn trong kho, viết thêm / AI gợi ý. */
export function QuickTestPanel({
    lesson,
    set,
    bank,
    open,
    approved,
    published,
    onToggleOpen,
    onApprove,
    onChange,
    say,
}: {
    lesson: Lesson
    set: TestSet
    bank: SourcedQuestion[]
    open: boolean
    approved: boolean
    /** Đề đã xuất bản: mới có lượt làm thật để hiện % đúng */
    published: boolean
    onToggleOpen: () => void
    onApprove: () => void
    onChange: (next: TestSet) => void
    say: (msg: string) => void
}) {
    const [rulesOpen, setRulesOpen] = useState(false)
    const [showRest, setShowRest] = useState(false)
    const [showIn, setShowIn] = useState(false)
    const [editing, setEditing] = useState<{ q: SourcedQuestion; replaces?: string; isBank: boolean } | null>(null)
    const inSet = resolveSet(set, bank)
    const inIds = new Set(set.ids)
    const rest = bank.filter((q) => !inIds.has(q.id))
    const n = inSet.length
    const need = passCount(set.rules, n)
    const setRules = (patch: Partial<TestRules>) => onChange({ ...set, rules: { ...set.rules, ...patch } })

    const ruleLine = `${n} câu · ${set.rules.secondsPerQuestion}s/câu · đạt từ ${need}/${n} · làm sau khi xem hết video`
    const seg = 'inline-flex rounded-[10px] bg-muted p-[3px]'
    const segBtn = (on: boolean) => `rounded-lg px-2.5 py-1.5 font-mono text-[13px] font-bold transition ${on ? 'bg-card text-strong shadow-card' : 'text-muted-foreground hover:text-strong'}`

    const pickRow = (q: SourcedQuestion, checked: boolean) => {
        // Chưa xuất bản thì không hiện số; đã xuất bản: câu có lượt làm hiện '% lớp đúng', câu mới thêm ghi chưa có lượt làm
        const rate = published && checked ? correctRate(q) : null
        return (
            <li key={q.id} className="grid grid-cols-[20px_1fr_auto] items-start gap-3 rounded-[10px] px-2 py-2.5 hover:bg-muted/60">
                <input
                    type="checkbox"
                    checked={checked}
                    aria-label={checked ? 'Bỏ khỏi đề' : 'Thêm vào đề'}
                    onChange={() => onChange(checked ? removeFromSet(set, q.id) : addToSet(set, q.id))}
                    className="mt-1 h-4 w-4 accent-brand-600"
                />
                <button type="button" onClick={() => setEditing({ q, replaces: set.custom.some((c) => c.id === q.id) ? undefined : q.id, isBank: !set.custom.some((c) => c.id === q.id) })} className={`min-w-0 text-left ${checked ? '' : 'text-muted-foreground'}`}>
                    <b className="block text-[15px] font-semibold leading-snug text-strong">{q.prompt}</b>
                    <small className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <SourceChip source={q.source} /> {lesson.concepts.find((c) => c.id === q.conceptId)?.name ?? ''}
                    </small>
                </button>
                {published && checked ? (
                    <em className={`text-xs not-italic ${rate === null ? 'text-muted-foreground/70' : `font-mono font-bold ${rate < 50 ? 'text-brand-ink' : 'text-muted-foreground'}`}`}>{rate === null ? 'chưa có lượt làm' : `${rate}% lớp đúng`}</em>
                ) : (
                    <span />
                )}
            </li>
        )
    }

    const suggest = () => {
        const { set: next, added } = suggestInto(set, bank, lesson.concepts.map((c) => c.id), 2)
        if (!added.length) return say('Kho đã hết câu để AI gợi ý thêm.')
        onChange(next)
        say(`AI đã thêm ${added.length} câu vào đề. Đọc lại rồi duyệt.`)
    }

    return (
        <ReviewRow
            domId="item-qt"
            open={open}
            done={approved}
            title="Đề kiểm tra nhanh"
            sub={`${n} câu · ${set.rules.secondsPerQuestion}s/câu · đạt từ ${need}/${n}`}
            onToggle={onToggleOpen}
        >
            <button type="button" onClick={() => setRulesOpen((v) => !v)} aria-expanded={rulesOpen} className="my-1.5 block w-full rounded-xl bg-muted px-3.5 py-3 text-left text-[13px] text-muted-foreground transition hover:bg-muted/70">
                <b className="font-mono font-bold text-strong">{ruleLine}</b> <span className="text-brand-ink">· đổi luật</span>
            </button>
            {rulesOpen && (
                <div className="mb-2 grid gap-3 rounded-xl border border-border p-3.5 text-[13.5px] text-foreground sm:grid-cols-3">
                    <div>
                        <p className="mb-1.5 text-xs font-bold text-muted-foreground">Số câu (4–8)</p>
                        <div className={seg}>
                            {[4, 5, 6, 7, 8].map((c) => (
                                <button key={c} type="button" onClick={() => setRules({ count: c })} className={segBtn(set.rules.count === c)} aria-pressed={set.rules.count === c}>
                                    {c}
                                </button>
                            ))}
                        </div>
                        <p className="mt-1 text-[11.5px] text-muted-foreground">Số câu cần có trong đề; AI soạn sẵn theo số này.</p>
                    </div>
                    <div>
                        <p className="mb-1.5 text-xs font-bold text-muted-foreground">Thời gian mỗi câu</p>
                        <div className={seg}>
                            {[45, 60, 90].map((c) => (
                                <button key={c} type="button" onClick={() => setRules({ secondsPerQuestion: c })} className={segBtn(set.rules.secondsPerQuestion === c)} aria-pressed={set.rules.secondsPerQuestion === c}>
                                    {c}s
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="mb-1.5 text-xs font-bold text-muted-foreground">Đạt từ</p>
                        <select
                            aria-label="Số câu đúng tối thiểu để đạt"
                            value={need}
                            onChange={(e) => setRules({ passRatio: Number(e.target.value) / Math.max(1, n) })}
                            className="h-9 rounded-[10px] border border-border bg-card px-2.5 font-mono text-[13px]"
                        >
                            {Array.from({ length: Math.max(1, n) }, (_, i) => i + 1).map((c) => (
                                <option key={c} value={c}>
                                    {c}/{n} câu đúng
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {editing ? (
                <QuestionEditor
                    question={editing.q}
                    concepts={lesson.concepts}
                    isBank={editing.isBank}
                    onChange={(q) => setEditing((cur) => (cur ? { ...cur, q: editing.isBank ? { ...q, id: editing.q.id.startsWith('tq-') ? editing.q.id : `tq-${editing.q.id}`, source: 'teacher' } : q } : cur))}
                    onDone={() => {
                        onChange(upsertCustom(set, editing.q, editing.replaces))
                        setEditing(null)
                    }}
                />
            ) : (
                <>
                    <p className="mx-2 mb-1 mt-3.5 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Trong đề · {n}</p>
                    <ul>{(showIn ? inSet : inSet.slice(0, 6)).map((q) => pickRow(q, true))}</ul>
                    {inSet.length > 6 && (
                        <button type="button" onClick={() => setShowIn((v) => !v)} aria-expanded={showIn} className="ml-2 mt-1 rounded-lg px-2 py-1.5 text-[13.5px] font-bold text-brand-ink transition hover:bg-brand-50">
                            {showIn ? 'Thu gọn ▴' : `Xem thêm ${inSet.length - 6} ▾`}
                        </button>
                    )}
                    {n === 0 && <p className="px-2 py-2 text-sm text-muted-foreground">Đề đang trống. Thêm câu từ kho hoặc nhờ AI gợi ý.</p>}
                    <p className="mx-2 mb-1 mt-4 text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Còn trong kho · {rest.length}</p>
                    <ul>{(showRest ? rest : rest.slice(0, 5)).map((q) => pickRow(q, false))}</ul>
                    {rest.length > 5 && (
                        <button type="button" onClick={() => setShowRest((v) => !v)} aria-expanded={showRest} className="ml-2 mt-1 rounded-lg px-2 py-1.5 text-[13.5px] font-bold text-brand-ink transition hover:bg-brand-50">
                            {showRest ? 'Thu gọn ▴' : `Xem thêm ${rest.length - 5} ▾`}
                        </button>
                    )}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={onApprove}
                            className={`inline-flex h-11 items-center gap-1.5 rounded-xl px-[18px] text-[15px] font-bold transition ${approved ? 'bg-success-soft text-success' : 'bg-strong text-background hover:opacity-90'}`}
                        >
                            {approved ? 'Đã duyệt đề' : 'Duyệt đề'}
                        </button>
                        <button type="button" onClick={() => setEditing({ q: blankQuestion(lesson.id, lesson.concepts[0]?.id ?? ''), isBank: false })} className="h-11 rounded-xl px-3 text-sm font-bold text-strong transition hover:bg-muted">
                            + Tự viết câu
                        </button>
                        <button type="button" onClick={suggest} className="h-11 rounded-xl px-3 text-sm font-bold text-brand-ink transition hover:bg-brand-50">
                            ✦ AI gợi ý
                        </button>
                    </div>
                </>
            )}
        </ReviewRow>
    )
}
