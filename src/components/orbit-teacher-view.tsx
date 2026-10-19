import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { BarChart3, CheckCircle2, ClipboardCheck, Eye, EyeOff, RotateCcw, Save, Sparkles, TriangleAlert } from 'lucide-react'
import { classStats, lessons } from '@/data'
import type { Lesson, LessonQuizQuestion, QuizChoiceQuestion } from '@/data/types'
import { useEffectiveLesson, useReviewStatus } from '@/lib/lesson-edits'
import { useOrbitStore, type LessonEdits } from '@/store/useOrbitStore'

type Section = 'review' | 'stats'

const fieldClass =
    'w-full rounded-md border border-input bg-white px-3 py-2 text-[15px] text-gray-900 transition duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'
const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-500'

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0)

/** /teacher – duyệt, sửa nội dung AI tạo và xem thống kê lớp. Chỉ dành cho vai trò giảng viên. */
export function OrbitTeacherView() {
    const role = useOrbitStore((s) => s.role)
    const [lessonId, setLessonId] = useState(lessons[0]?.id)
    const [section, setSection] = useState<Section>('review')
    const lesson = useEffectiveLesson(lessonId)

    if (role !== 'teacher') return <Navigate to="/" replace />

    return (
        <div className="h-full w-full overflow-y-auto bg-surface">
            <div className="mx-auto flex max-w-5xl flex-col gap-8 px-5 py-8 lg:px-8 lg:py-12">
                <header>
                    <p className="text-eyebrow uppercase text-brand-600">Dành cho giảng viên</p>
                    <h1 className="mt-3 text-headline text-gray-900">Duyệt nội dung và theo dõi lớp</h1>
                    <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-gray-600">
                        Nội dung do AI tạo từ video bài giảng. Sinh viên chỉ thấy bài sau khi bạn xem lại, chỉnh sửa và xuất bản.
                    </p>
                </header>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Chọn bài học">
                        {lessons.map((l) => (
                            <button
                                key={l.id}
                                type="button"
                                role="tab"
                                aria-selected={l.id === lessonId}
                                onClick={() => setLessonId(l.id)}
                                className={`rounded-full border px-4 py-2 text-sm font-semibold transition duration-fast ${
                                    l.id === lessonId
                                        ? 'border-brand-600 bg-brand-600 text-white'
                                        : 'border-border bg-white text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                {l.title}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex gap-1 border-b border-border" role="tablist" aria-label="Mục">
                    <SectionTab active={section === 'review'} onClick={() => setSection('review')} icon={<ClipboardCheck size={16} />}>
                        Duyệt nội dung
                    </SectionTab>
                    <SectionTab active={section === 'stats'} onClick={() => setSection('stats')} icon={<BarChart3 size={16} />}>
                        Thống kê lớp
                    </SectionTab>
                </div>

                {!lesson ? (
                    <p className="text-gray-500">Chưa có bài học nào.</p>
                ) : section === 'review' ? (
                    // key: đổi bài thì dựng lại form từ nội dung của bài đó
                    <ReviewPanel key={lesson.id} lesson={lesson} />
                ) : (
                    <StatsPanel lesson={lesson} onEdit={() => setSection('review')} />
                )}
            </div>
        </div>
    )
}

function SectionTab({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            onClick={onClick}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition duration-fast ${
                active ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
        >
            {icon}
            {children}
        </button>
    )
}

// ─── Duyệt và sửa nội dung ─────────────────────────────────────────────────

function ReviewPanel({ lesson }: { lesson: Lesson }) {
    const status = useReviewStatus(lesson)
    const hasEdits = useOrbitStore((s) => Boolean(s.lessonEdits[lesson.id]))
    const setLessonReview = useOrbitStore((s) => s.setLessonReview)
    const setLessonEdits = useOrbitStore((s) => s.setLessonEdits)

    const [draft, setDraft] = useState<LessonEdits>(() => ({
        summary: lesson.summary,
        concepts: lesson.concepts,
        quiz: lesson.quiz,
    }))
    const [savedAt, setSavedAt] = useState(false)

    const dirty = useMemo(
        () => JSON.stringify(draft) !== JSON.stringify({ summary: lesson.summary, concepts: lesson.concepts, quiz: lesson.quiz }),
        [draft, lesson],
    )
    const problems = useMemo(() => validate(draft), [draft])
    const published = status === 'published'

    const save = () => {
        if (problems.length > 0) return false
        setLessonEdits(lesson.id, draft)
        setSavedAt(true)
        return true
    }

    const togglePublish = () => {
        // Xuất bản luôn kèm lưu các chỉnh sửa đang dở, để sinh viên thấy đúng bản vừa duyệt
        if (!published && dirty && !save()) return
        setLessonReview(lesson.id, published ? 'draft' : 'published')
    }

    const revert = () => {
        if (!window.confirm('Bỏ mọi chỉnh sửa và quay về bản AI tạo?')) return
        setLessonEdits(lesson.id, null)
        // lesson (đã áp chỉnh sửa) sẽ đổi sau lần render này; đọc lại bản gốc từ JSON
        const original = lessonsOriginal(lesson.id)
        if (original) setDraft({ summary: original.summary, concepts: original.concepts, quiz: original.quiz })
        setSavedAt(false)
    }

    const patchConcept = (i: number, patch: Partial<LessonEdits['concepts'][number]>) => {
        setSavedAt(false)
        setDraft((d) => ({ ...d, concepts: d.concepts.map((c, j) => (j === i ? { ...c, ...patch } : c)) }))
    }
    const patchQuestion = (i: number, q: LessonQuizQuestion) => {
        setSavedAt(false)
        setDraft((d) => ({ ...d, quiz: d.quiz.map((old, j) => (j === i ? q : old)) }))
    }

    return (
        <div className="flex flex-col gap-8">
            {/* Thanh trạng thái xuất bản */}
            <div className="flex flex-wrap items-center gap-4 rounded-card border border-border bg-card p-5 shadow-card">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                                published ? 'bg-success/10 text-success' : 'bg-warning/20 text-gray-800'
                            }`}
                        >
                            {published ? <Eye size={13} /> : <EyeOff size={13} />}
                            {published ? 'Đã xuất bản' : 'Bản nháp'}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-gray-600">
                            <Sparkles size={13} />
                            {lesson.origin === 'gemini' ? 'Nội dung do Gemini tạo' : 'Dữ liệu mẫu'}
                        </span>
                        {hasEdits && (
                            <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-700">Đã chỉnh bởi giảng viên</span>
                        )}
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                        {published ? 'Sinh viên đang xem được bài này.' : 'Sinh viên chưa thấy bài này cho tới khi bạn xuất bản.'}
                    </p>
                </div>
                {hasEdits && (
                    <button type="button" onClick={revert} className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-gray-600 transition hover:bg-muted">
                        <RotateCcw size={15} /> Về bản AI
                    </button>
                )}
                <button
                    type="button"
                    onClick={save}
                    disabled={!dirty || problems.length > 0}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-5 py-2.5 text-sm font-bold text-gray-800 transition hover:border-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Save size={15} /> Lưu chỉnh sửa
                </button>
                <button
                    type="button"
                    onClick={togglePublish}
                    disabled={!published && problems.length > 0}
                    className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        published ? 'border border-border bg-white text-gray-800 hover:border-gray-300' : 'bg-brand-600 text-white shadow-brand hover:bg-brand-700'
                    }`}
                >
                    {published ? <EyeOff size={15} /> : <CheckCircle2 size={15} />}
                    {published ? 'Gỡ xuất bản' : 'Xuất bản'}
                </button>
            </div>

            <div aria-live="polite" className="-mt-4 min-h-5 text-sm">
                {problems.length > 0 ? (
                    <p className="flex items-start gap-2 text-destructive">
                        <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                        <span>{problems[0]}{problems.length > 1 ? ` (và ${problems.length - 1} lỗi khác)` : ''}</span>
                    </p>
                ) : savedAt && !dirty ? (
                    <p className="flex items-center gap-2 text-success">
                        <CheckCircle2 size={16} /> Đã lưu chỉnh sửa.
                    </p>
                ) : null}
            </div>

            {/* Tóm tắt */}
            <section>
                <h2 className="text-title text-gray-900">Tóm tắt bài giảng</h2>
                <textarea
                    aria-label="Tóm tắt bài giảng"
                    value={draft.summary}
                    onChange={(e) => {
                        setSavedAt(false)
                        setDraft((d) => ({ ...d, summary: e.target.value }))
                    }}
                    rows={4}
                    className={`${fieldClass} mt-4 resize-y leading-relaxed`}
                />
            </section>

            {/* Khái niệm */}
            <section>
                <h2 className="text-title text-gray-900">Khái niệm ({draft.concepts.length})</h2>
                <div className="mt-4 flex flex-col gap-4">
                    {draft.concepts.map((c, i) => {
                        const stat = classStats.concepts[c.id]
                        return (
                            <div key={c.id} className="rounded-card border border-border bg-card p-5 shadow-card">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-mono text-xs text-gray-500">
                                        {fmt(c.segment.start)}–{fmt(c.segment.end)}
                                    </span>
                                    {stat && <ErrorRateTag rate={pct(stat.wrongFirstTry, stat.answered)} />}
                                </div>
                                <label className={`${labelClass} mt-3`} htmlFor={`concept-name-${c.id}`}>Tên khái niệm</label>
                                <input id={`concept-name-${c.id}`} value={c.name} onChange={(e) => patchConcept(i, { name: e.target.value })} className={fieldClass} />
                                <label className={`${labelClass} mt-4`} htmlFor={`concept-def-${c.id}`}>Định nghĩa</label>
                                <textarea id={`concept-def-${c.id}`} value={c.definition} onChange={(e) => patchConcept(i, { definition: e.target.value })} rows={3} className={`${fieldClass} resize-y leading-relaxed`} />
                            </div>
                        )
                    })}
                </div>
            </section>

            {/* Câu hỏi */}
            <section>
                <h2 className="text-title text-gray-900">Câu hỏi trong video ({draft.quiz.length})</h2>
                <div className="mt-4 flex flex-col gap-4">
                    {draft.quiz.map((q, i) => (
                        <div key={q.id} className="rounded-card border border-border bg-card p-5 shadow-card">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-mono text-xs text-gray-500">Dừng video tại {fmt(q.pauseAt)}</span>
                                {classStats.concepts[q.conceptId] && (
                                    <ErrorRateTag rate={pct(classStats.concepts[q.conceptId].wrongFirstTry, classStats.concepts[q.conceptId].answered)} />
                                )}
                            </div>
                            <QuestionEditor question={q} onChange={(next) => patchQuestion(i, { ...q, ...next })} />
                            <div className="mt-6 flex flex-col gap-4 border-l-2 border-brand-100 pl-4">
                                <p className="text-sm font-bold text-gray-700">Câu biến thể cho vòng củng cố ({q.variants.length})</p>
                                {q.variants.map((v, vi) => (
                                    <div key={v.id} className="rounded-card bg-surface p-4">
                                        <QuestionEditor
                                            question={v}
                                            onChange={(next) =>
                                                patchQuestion(i, { ...q, variants: q.variants.map((old, j) => (j === vi ? { ...old, ...next } : old)) })
                                            }
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    )
}

function QuestionEditor({ question, onChange }: { question: QuizChoiceQuestion; onChange: (next: QuizChoiceQuestion) => void }) {
    const setOption = (i: number, text: string) => onChange({ ...question, options: question.options.map((o, j) => (j === i ? text : o)) })
    return (
        <div>
            <label className={labelClass} htmlFor={`${question.id}-prompt`}>Câu hỏi</label>
            <textarea id={`${question.id}-prompt`} value={question.prompt} onChange={(e) => onChange({ ...question, prompt: e.target.value })} rows={2} className={`${fieldClass} resize-y`} />
            <fieldset className="mt-4">
                <legend className={labelClass}>Đáp án (chọn vòng tròn ở đáp án đúng)</legend>
                <div className="flex flex-col gap-2">
                    {question.options.map((opt, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <input
                                type="radio"
                                name={`${question.id}-correct`}
                                checked={question.correctIndex === i}
                                onChange={() => onChange({ ...question, correctIndex: i })}
                                aria-label={`Đáp án ${i + 1} là đáp án đúng`}
                                className="h-4 w-4 shrink-0 accent-brand-600"
                            />
                            <input value={opt} onChange={(e) => setOption(i, e.target.value)} aria-label={`Đáp án ${i + 1}`} className={fieldClass} />
                        </div>
                    ))}
                </div>
            </fieldset>
            <label className={`${labelClass} mt-4`} htmlFor={`${question.id}-explain`}>Giải thích</label>
            <textarea id={`${question.id}-explain`} value={question.explanation} onChange={(e) => onChange({ ...question, explanation: e.target.value })} rows={2} className={`${fieldClass} resize-y leading-relaxed`} />
        </div>
    )
}

function ErrorRateTag({ rate }: { rate: number }) {
    const high = rate >= 50
    return (
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${high ? 'bg-brand-soft text-brand-700' : 'bg-muted text-gray-600'}`}>
            {rate}% lớp sai lần đầu
        </span>
    )
}

// ─── Thống kê lớp ──────────────────────────────────────────────────────────

function StatsPanel({ lesson, onEdit }: { lesson: Lesson; onEdit: () => void }) {
    const rows = lesson.concepts
        .map((c) => {
            const s = classStats.concepts[c.id]
            return { concept: c, stat: s, rate: s ? pct(s.wrongFirstTry, s.answered) : null }
        })
        .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1))
    const worst = rows[0]?.rate != null && rows[0].rate >= 50 ? rows[0] : null

    return (
        <div className="flex flex-col gap-8">
            <p className="rounded-card bg-muted px-4 py-3 text-sm text-gray-600">
                {classStats.note} Lớp mẫu có <span className="font-mono font-bold text-gray-800">{classStats.classSize}</span> sinh viên.
            </p>

            {worst && (
                <div className="flex flex-wrap items-center gap-4 rounded-panel bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white shadow-brand">
                    <TriangleAlert size={28} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                        <p className="text-eyebrow uppercase text-brand-200">Cần chú ý nhất</p>
                        <p className="mt-1 text-xl font-bold">
                            {worst.concept.name}: {worst.rate}% sinh viên sai ngay lần đầu
                        </p>
                        <p className="mt-1 text-sm text-brand-100">Nên xem lại cách giảng hoặc câu hỏi ở khái niệm này trên lớp.</p>
                    </div>
                    <button type="button" onClick={onEdit} className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-brand-700 transition hover:bg-brand-50">
                        Xem nội dung
                    </button>
                </div>
            )}

            <section>
                <h2 className="text-title text-gray-900">Tỉ lệ sai lần đầu theo khái niệm</h2>
                <ul className="mt-4 flex flex-col gap-3">
                    {rows.map(({ concept, stat, rate }) => (
                        <li key={concept.id} className="rounded-card border border-border bg-card p-5 shadow-card">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="font-bold text-gray-900">{concept.name}</span>
                                {stat ? (
                                    <span className="font-mono text-2xl font-bold text-gray-900">{rate}%</span>
                                ) : (
                                    <span className="text-sm text-gray-500">Chưa có dữ liệu</span>
                                )}
                            </div>
                            {stat && (
                                <>
                                    <div
                                        className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted"
                                        role="img"
                                        aria-label={`${rate}% sai lần đầu`}
                                    >
                                        <div className={`h-full rounded-full ${(rate ?? 0) >= 50 ? 'bg-brand-600' : 'bg-gray-400'}`} style={{ width: `${rate}%` }} />
                                    </div>
                                    <p className="mt-2 text-sm text-gray-600">
                                        <span className="font-mono">{stat.wrongFirstTry}</span>/<span className="font-mono">{stat.answered}</span> sinh viên sai lần đầu,{' '}
                                        <span className="font-mono">{stat.corrected}</span> trong số đó sửa đúng sau khi xem lại đoạn video
                                        {' '}({pct(stat.corrected, stat.wrongFirstTry)}%).
                                    </p>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            </section>

            <section>
                <h2 className="text-title text-gray-900">Sinh viên chọn đáp án nào</h2>
                <div className="mt-4 flex flex-col gap-4">
                    {lesson.quiz.map((q) => {
                        const picks = classStats.questions[q.id]?.picks
                        const total = picks?.reduce((a, b) => a + b, 0) ?? 0
                        return (
                            <div key={q.id} className="rounded-card border border-border bg-card p-5 shadow-card">
                                <p className="font-bold text-gray-900">{q.prompt}</p>
                                {!picks || total === 0 ? (
                                    <p className="mt-2 text-sm text-gray-500">Chưa có dữ liệu.</p>
                                ) : (
                                    <ul className="mt-4 flex flex-col gap-2.5">
                                        {q.options.map((opt, i) => {
                                            const n = picks[i] ?? 0
                                            const correct = i === q.correctIndex
                                            return (
                                                <li key={i}>
                                                    <div className="flex items-center justify-between gap-3 text-sm">
                                                        <span className={correct ? 'font-bold text-success' : 'text-gray-700'}>
                                                            {opt}
                                                            {correct && ' (đúng)'}
                                                        </span>
                                                        <span className="font-mono text-gray-600">{pct(n, total)}%</span>
                                                    </div>
                                                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                                                        <div className={`h-full rounded-full ${correct ? 'bg-success' : 'bg-gray-400'}`} style={{ width: `${pct(n, total)}%` }} />
                                                    </div>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                )}
                            </div>
                        )
                    })}
                </div>
            </section>
        </div>
    )
}

// ─── Tiện ích ──────────────────────────────────────────────────────────────

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`

function lessonsOriginal(id: string) {
    return lessons.find((l) => l.id === id)
}

function validate(d: LessonEdits): string[] {
    const errors: string[] = []
    if (!d.summary.trim()) errors.push('Tóm tắt không được để trống.')
    for (const c of d.concepts) {
        if (!c.name.trim() || !c.definition.trim()) errors.push(`Khái niệm "${c.name || c.id}" thiếu tên hoặc định nghĩa.`)
    }
    const checkQ = (q: QuizChoiceQuestion) => {
        if (!q.prompt.trim()) errors.push(`Câu hỏi ${q.id} đang trống.`)
        else if (q.options.some((o) => !o.trim())) errors.push(`Câu hỏi "${q.prompt}" có đáp án để trống.`)
        else if (new Set(q.options.map((o) => o.trim())).size !== q.options.length) errors.push(`Câu hỏi "${q.prompt}" có hai đáp án giống nhau.`)
    }
    for (const q of d.quiz) {
        checkQ(q)
        q.variants.forEach(checkQ)
    }
    return errors
}
