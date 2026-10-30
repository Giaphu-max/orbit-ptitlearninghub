import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { blankQuestion, QuestionEditor } from '@/components/teacher/question-editor'
import { SourceChip } from '@/components/teacher/quick-test-panel'
import { correctRate, courseFullyPublished, coverage, finalKey, finalSetFor, moveInSet, passCount, removeFromSet, resolveSet, sourcedBank, suggestInto, upsertCustom, useCourseAllLessons, type SourcedQuestion, type TestRules, type TestSet } from '@/lib/test-sets'
import { useTeacherCourses } from '@/lib/teacher'
import { useOrbitStore } from '@/store/useOrbitStore'

const seg = 'inline-flex rounded-[10px] bg-muted p-[3px]'
const segBtn = (on: boolean) => `rounded-lg px-2.5 py-1.5 font-mono text-[12.5px] font-bold transition ${on ? 'bg-card text-strong shadow-card' : 'text-muted-foreground hover:text-strong'}`
const selCls = 'h-[34px] rounded-[10px] border border-border bg-card px-2.5 text-[13px] text-foreground'

/** /teacher/test/:courseId – soạn Test cuối chương: độ phủ khái niệm, danh sách câu (kéo thả đổi thứ tự), cài đặt bài thi, xuất bản. */
export function OrbitTeacherTestView() {
    const role = useOrbitStore((s) => s.role)
    const { courseId } = useParams()
    const courses = useTeacherCourses()
    const course = courses.find((c) => c.id === courseId)
    if (role !== 'teacher') return <Navigate to="/" replace />
    if (!course || !courseId) return <Navigate to="/teacher/library" replace />
    return <Builder key={course.id} courseId={course.id} title={course.title} />
}

function Builder({ courseId, title }: { courseId: string; title: string }) {
    const lessons = useCourseAllLessons(courseId)
    const stored = useOrbitStore((s) => s.testSets[finalKey(courseId)])
    const fullyPublished = useOrbitStore((s) => courseFullyPublished(courseId, s))
    const setTestSet = useOrbitStore((s) => s.setTestSet)
    const bank = useMemo(() => sourcedBank(lessons), [lessons])
    const set = useMemo(() => finalSetFor(lessons, stored), [lessons, stored])
    const published = stored?.published ?? fullyPublished
    const questions = useMemo(() => resolveSet(set, bank), [set, bank])
    const concepts = useMemo(() => lessons.flatMap((l) => l.concepts), [lessons])
    const cover = coverage(questions)
    const missing = concepts.filter((c) => !cover.get(c.id))
    const rules = set.rules
    const need = passCount(rules, questions.length)
    const minutes = Math.ceil((questions.length * rules.secondsPerQuestion) / 60)

    const save = useCallback((next: TestSet, pub = published) => setTestSet(finalKey(courseId), { ...next, published: pub }), [courseId, published, setTestSet])
    const setRules = (patch: Partial<TestRules>) => {
        // Đọc đề mới nhất trong store để hai lần chỉnh liên tiếp không ghi đè nhau
        const cur = useOrbitStore.getState().testSets[finalKey(courseId)] ?? set
        save({ ...cur, rules: { ...cur.rules, ...patch } })
    }

    const [toast, setToast] = useState<string | null>(null)
    const timer = useRef<number | undefined>(undefined)
    const say = useCallback((msg: string) => {
        setToast(msg)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setToast(null), 2800)
    }, [])
    useEffect(() => () => window.clearTimeout(timer.current), [])

    const [editing, setEditing] = useState<{ q: SourcedQuestion; replaces?: string; isBank: boolean } | null>(null)
    const [bankOpen, setBankOpen] = useState(false)
    const [showAll, setShowAll] = useState(false)
    const [dragFrom, setDragFrom] = useState<number | null>(null)
    const [live, setLive] = useState('')
    const lessonOf = (conceptId: string) => lessons.find((l) => l.concepts.some((c) => c.id === conceptId))
    const conceptName = (id: string) => concepts.find((c) => c.id === id)?.name ?? ''

    const move = (from: number, to: number) => {
        const next = moveInSet(set, from, to)
        if (next === set) return
        save(next)
        setLive(`Đã chuyển câu ${from + 1} tới vị trí ${to + 1}`)
    }
    const suggest = (conceptIds: string[], n: number) => {
        const { set: next, added } = suggestInto(set, bank, conceptIds, n)
        if (!added.length) return say('Kho đã hết câu để AI gợi ý thêm.')
        save(next)
        say(`AI đã thêm ${added.length} câu vào đề.`)
    }
    const publish = () => {
        if (questions.length === 0) return say('Đề đang trống. Thêm ít nhất một câu rồi xuất bản.')
        save(set, true)
        say('Đã xuất bản đề · sinh viên làm đúng đề và luật này')
    }

    const shown = showAll ? questions : questions.slice(0, 6)
    const rest = bank.filter((q) => !set.ids.includes(q.id))
    const dot = 'text-muted-foreground/50'

    return (
        <div className="w-full pb-8">
            <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div className="min-w-0 flex-1 basis-[420px]">
                    <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-muted-foreground">
                        <Link to="/teacher/library" className="font-bold transition hover:text-strong">
                            ‹ Bài giảng
                        </Link>
                        <span className="font-bold">{title}</span>
                        <em className="rounded-md bg-brand-50 px-2 py-[3px] font-mono text-[11.5px] font-bold not-italic text-brand-ink">
                            {lessons.length} bài · {concepts.length} khái niệm
                        </em>
                    </div>
                    <h1 className="mt-1 text-[28px] font-black leading-tight tracking-tight text-strong">Test cuối chương</h1>
                </div>
                <nav aria-label="Các bước soạn đề" className="flex shrink-0 items-center gap-1 text-xs font-semibold">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-success">✓ AI soạn đề</span>
                    <span aria-hidden className={dot}>→</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${published ? 'text-success' : 'bg-brand-50 text-brand-ink'}`} aria-current={published ? undefined : 'step'}>
                        {published ? '✓' : <b className="font-mono">2</b>} Thầy cô chỉnh
                    </span>
                    <span aria-hidden className={dot}>→</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${published ? 'bg-brand-50 text-brand-ink' : 'text-muted-foreground'}`}>
                        <b className="font-mono">3</b> Xuất bản
                    </span>
                </nav>
            </header>

            <section className="lesson-grid mt-6 items-start">
                <div className="min-w-0">
                    <div className="rounded-[20px] border border-border bg-card px-5 py-[18px] shadow-card">
                        <div className="flex items-baseline justify-between gap-3">
                            <b className="text-[15px] text-strong">Độ phủ khái niệm</b>
                            <small className="text-[12.5px] text-muted-foreground">mỗi khái niệm nên có ít nhất 1 câu</small>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            {concepts.map((c) => {
                                const n = cover.get(c.id) ?? 0
                                return (
                                    <span key={c.id} className={`inline-flex items-center gap-2 rounded-full border bg-card py-1.5 pl-3 pr-1.5 text-[13px] ${n === 0 ? 'border-dashed border-brand-100' : 'border-border'}`}>
                                        <b className="font-semibold text-strong">{c.name}</b>
                                        <em className={`flex h-[22px] min-w-[22px] items-center justify-center rounded-full font-mono text-[11.5px] font-extrabold not-italic ${n === 0 ? 'bg-brand-600 text-ink-foreground' : 'bg-success-soft text-success'}`}>{n}</em>
                                    </span>
                                )
                            })}
                        </div>
                        {missing.length > 0 && (
                            <p className="mt-3 text-[13.5px] text-muted-foreground">
                                Chưa có câu nào về <b className="text-strong">{missing.map((m) => m.name).join(', ')}</b>
                                {missing.length === 1 && lessonOf(missing[0].id) ? ` (bài ${lessons.indexOf(lessonOf(missing[0].id)!) + 1})` : ''}.{' '}
                                <button type="button" onClick={() => suggest(missing.map((m) => m.id), 2)} className="ml-1.5 font-extrabold text-brand-ink hover:underline">
                                    ✦ AI gợi ý 2 câu
                                </button>
                            </p>
                        )}
                    </div>

                    <div className="mb-2.5 mt-7 flex items-baseline justify-between px-0.5">
                        <h2 className="text-[22px] font-black text-strong">
                            Câu hỏi trong đề <span className="ml-1.5 font-mono text-base font-extrabold text-muted-foreground">{questions.length}</span>
                        </h2>
                        <span className="text-[12.5px] text-muted-foreground">Kéo để đổi thứ tự (hoặc Alt + ↑/↓) · bấm để sửa</span>
                    </div>
                    <p className="sr-only" role="status" aria-live="polite">
                        {live}
                    </p>
                    <div className="rounded-[20px] border border-border bg-card p-1.5 shadow-card">
                        <ul>
                            {shown.map((q, i) =>
                                editing && (editing.replaces ?? editing.q.id) === q.id ? (
                                    <li key={q.id} className="p-2">
                                        <QuestionEditor question={editing.q} concepts={concepts} isBank={editing.isBank} onChange={(next) => setEditing((cur) => (cur ? { ...cur, q: cur.isBank ? { ...next, id: cur.q.id.startsWith('tq-') ? cur.q.id : `tq-${cur.q.id}`, source: 'teacher' } : next } : cur))} onDone={() => (save(upsertCustom(set, editing.q, editing.replaces)), setEditing(null))} />
                                    </li>
                                ) : (
                                    <li
                                        key={q.id}
                                        draggable
                                        onDragStart={() => setDragFrom(i)}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={() => (dragFrom !== null && move(dragFrom, i), setDragFrom(null))}
                                        onDragEnd={() => setDragFrom(null)}
                                        className={`grid grid-cols-[18px_30px_1fr_auto_30px] items-center gap-3 rounded-xl px-3 py-[13px] transition hover:bg-muted/60 [&+&]:border-t [&+&]:border-border ${dragFrom === i ? 'opacity-50' : ''}`}
                                    >
                                        <button
                                            type="button"
                                            aria-label={`Kéo để đổi thứ tự câu ${i + 1}; Alt cùng mũi tên lên xuống để di chuyển`}
                                            onKeyDown={(e) => {
                                                if (!e.altKey) return
                                                if (e.key === 'ArrowUp') (e.preventDefault(), move(i, i - 1))
                                                if (e.key === 'ArrowDown') (e.preventDefault(), move(i, i + 1))
                                            }}
                                            className="cursor-grab text-xs tracking-[-2px] text-muted-foreground/60 focus-visible:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                                        >
                                            ⋮⋮
                                        </button>
                                        <span className="font-mono text-xs font-bold text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                                        <button type="button" onClick={() => setEditing({ q, replaces: set.custom.some((c) => c.id === q.id) ? undefined : q.id, isBank: !set.custom.some((c) => c.id === q.id) })} className="min-w-0 text-left">
                                            <b className="block text-[14.5px] font-semibold leading-snug text-strong">{q.prompt}</b>
                                            <small className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                                <SourceChip source={q.source} />
                                                Bài {Math.max(1, lessons.findIndex((l) => l.id === q.lessonId) + 1)} · {conceptName(q.conceptId)}
                                            </small>
                                        </button>
                                        <Rate q={q} />
                                        <button type="button" aria-label={`Bỏ câu ${i + 1} khỏi đề`} onClick={() => save(removeFromSet(set, q.id))} className="h-7 w-7 rounded-lg text-[13px] text-muted-foreground transition hover:bg-brand-50 hover:text-brand-ink">
                                            ✕
                                        </button>
                                    </li>
                                ),
                            )}
                        </ul>
                        {questions.length === 0 && <p className="px-3 py-4 text-sm text-muted-foreground">Đề đang trống. Lấy câu từ kho hoặc nhờ AI gợi ý.</p>}
                        {!showAll && questions.length > 6 && (
                            <button type="button" onClick={() => setShowAll(true)} className="block w-full border-t border-border px-3 py-2.5 text-left text-[13px] font-bold text-muted-foreground transition hover:text-strong">
                                + {questions.length - 6} câu nữa
                            </button>
                        )}
                        {editing && !questions.some((q) => q.id === (editing.replaces ?? editing.q.id)) && (
                            <div className="border-t border-border p-2">
                                <QuestionEditor question={editing.q} concepts={concepts} isBank={false} onChange={(next) => setEditing((cur) => (cur ? { ...cur, q: next } : cur))} onDone={() => (save(upsertCustom(set, editing.q, editing.replaces)), setEditing(null))} />
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2 border-t border-border p-3">
                            <button
                                type="button"
                                onClick={() => {
                                    const c = concepts[0]
                                    if (c) setEditing({ q: blankQuestion(lessonOf(c.id)?.id ?? lessons[0]?.id ?? '', c.id), isBank: false })
                                }}
                                className="h-[38px] rounded-[10px] border border-border bg-card px-3.5 text-[13.5px] font-bold text-strong transition hover:bg-muted"
                            >
                                + Tự viết câu
                            </button>
                            <button type="button" onClick={() => setBankOpen((v) => !v)} aria-expanded={bankOpen} className="h-[38px] rounded-[10px] border border-border bg-card px-3.5 text-[13.5px] font-bold text-strong transition hover:bg-muted">
                                Lấy từ kho câu hỏi · {rest.length}
                            </button>
                            <button type="button" onClick={() => suggest(missing.map((m) => m.id), 2)} className="h-[38px] rounded-[10px] border border-brand-100 bg-card px-3.5 text-[13.5px] font-bold text-brand-ink transition hover:bg-brand-50">
                                ✦ AI gợi ý thêm
                            </button>
                        </div>
                        {bankOpen && (
                            <ul className="max-h-[360px] overflow-auto border-t border-border p-2">
                                {rest.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">Kho đã hết câu để thêm.</li>}
                                {rest.map((q) => (
                                    <li key={q.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-[10px] px-2.5 py-2.5 hover:bg-muted/60">
                                        <span className="min-w-0">
                                            <b className="block text-[14px] font-semibold leading-snug text-strong">{q.prompt}</b>
                                            <small className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                                                <SourceChip source={q.source} /> {conceptName(q.conceptId)}
                                            </small>
                                        </span>
                                        <Rate q={q} />
                                        <button type="button" onClick={() => save({ ...set, ids: [...set.ids, q.id] })} className="h-8 rounded-lg bg-brand-50 px-3 text-[13px] font-bold text-brand-ink transition hover:bg-brand-100">
                                            Thêm
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <aside className="min-w-0 rounded-[20px] border border-border bg-card p-[22px] shadow-card lg:sticky lg:top-[88px]">
                    <h2 className="mb-1.5 text-base font-extrabold text-strong">Cài đặt bài thi</h2>
                    <Row label="Thời gian mỗi câu">
                        <div className={seg}>
                            {[45, 60, 90].map((v) => (
                                <button key={v} type="button" aria-pressed={rules.secondsPerQuestion === v} onClick={() => setRules({ secondsPerQuestion: v })} className={segBtn(rules.secondsPerQuestion === v)}>
                                    {v}s
                                </button>
                            ))}
                        </div>
                    </Row>
                    <Row label="Ngưỡng đạt">
                        <div className={seg}>
                            {[0.7, 0.8, 0.9].map((v) => (
                                <button key={v} type="button" aria-pressed={Math.abs(rules.passRatio - v) < 0.001} onClick={() => setRules({ passRatio: v })} className={segBtn(Math.abs(rules.passRatio - v) < 0.001)}>
                                    {Math.round(v * 100)}%
                                </button>
                            ))}
                        </div>
                    </Row>
                    <Row label="Mở khi sinh viên">
                        <select value={rules.opens} onChange={(e) => setRules({ opens: e.target.value as TestRules['opens'] })} className={selCls} aria-label="Điều kiện mở">
                            <option value="all">Xong cả {lessons.length} bài</option>
                            <option value="almost">Xong {Math.max(0, lessons.length - 1)}/{lessons.length} bài</option>
                            <option value="now">Mở ngay</option>
                        </select>
                    </Row>
                    <Row label="Số lần làm">
                        <select value={rules.attempts ?? 'inf'} onChange={(e) => setRules({ attempts: e.target.value === 'inf' ? null : Number(e.target.value) })} className={selCls} aria-label="Số lần làm">
                            <option value="inf">Không giới hạn</option>
                            <option value="3">3 lần</option>
                            <option value="1">1 lần</option>
                        </select>
                    </Row>
                    <Toggle label="Trộn thứ tự câu hỏi" on={rules.shuffleQuestions} onChange={(v) => setRules({ shuffleQuestions: v })} />
                    <Toggle label="Trộn thứ tự đáp án" on={rules.shuffleOptions} onChange={(v) => setRules({ shuffleOptions: v })} />
                    <Toggle label="Sai thì AI giải thích và tua về đoạn video" on={rules.explainWrong} onChange={(v) => setRules({ explainWrong: v })} />
                    <div className="mt-3 rounded-[14px] bg-muted p-3.5">
                        <small className="block text-xs text-muted-foreground">Sinh viên sẽ thấy</small>
                        <b className="mt-1 block font-mono text-[15px] font-extrabold text-strong">
                            {questions.length} câu · {minutes} phút · đạt từ {need}/{questions.length}
                        </b>
                    </div>
                    <button type="button" onClick={publish} disabled={published} className="surface-red mt-3.5 h-[46px] w-full rounded-[11px] text-[15px] font-extrabold text-ink-foreground shadow-brand disabled:cursor-default disabled:opacity-60">
                        {published ? 'Đã xuất bản' : 'Xuất bản đề'}
                    </button>
                    {published && (
                        <button type="button" onClick={() => (save(set, false), say('Đã gỡ xuất bản · sinh viên không làm được Test cuối chương'))} className="mt-2 block w-full text-center text-[13px] font-bold text-muted-foreground transition hover:text-strong">
                            Gỡ xuất bản
                        </button>
                    )}
                    <Link to={`/teacher/test/${courseId}/preview`} className="mt-3 block text-center text-sm font-bold text-muted-foreground transition hover:text-strong">
                        Làm thử đề này
                    </Link>
                </aside>
            </section>

            <div
                role="status"
                className={`pointer-events-none fixed bottom-7 left-1/2 z-[60] max-w-[80vw] -translate-x-1/2 rounded-full bg-ink px-[18px] py-3 text-sm font-semibold text-ink-foreground shadow-raised transition duration-slow ${toast ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}
            >
                {toast}
            </div>
        </div>
    )
}

function Rate({ q }: { q: SourcedQuestion }) {
    const r = correctRate(q)
    return <span className={`font-mono text-xs font-bold ${r === null ? 'text-success' : r < 50 ? 'text-brand-ink' : 'text-muted-foreground'}`}>{r === null ? 'mới' : `${r}% đúng`}</span>
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3 border-b border-border py-3 text-sm text-foreground">
            <span>{label}</span>
            {children}
        </div>
    )
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
    return (
        <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex w-full items-center gap-2.5 py-2.5 text-left text-[13.5px] text-foreground">
            <i aria-hidden className={`relative h-[18px] w-[30px] flex-none rounded-full transition ${on ? 'bg-success-bright' : 'bg-border'}`}>
                <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-ink-foreground transition-all ${on ? 'left-3.5' : 'left-0.5'}`} />
            </i>
            {label}
        </button>
    )
}
